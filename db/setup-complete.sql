-- ============================================
-- BookByte Complete Database Setup Script
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. BASE SCHEMA: Books table
-- ============================================

CREATE TABLE IF NOT EXISTS public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  cover_url text,
  file_url text,
  summary jsonb NOT NULL,
  audio_urls jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress_percent numeric(5,2) DEFAULT 0,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert their own summaries" ON public.books;
DROP POLICY IF EXISTS "Users can select their own summaries" ON public.books;
DROP POLICY IF EXISTS "Anyone can select public summaries" ON public.books;
DROP POLICY IF EXISTS "Users can update their own summaries" ON public.books;
DROP POLICY IF EXISTS "Users can delete their own summaries" ON public.books;

CREATE POLICY "Users can insert their own summaries" ON public.books
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own summaries" ON public.books
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can select public summaries" ON public.books
  FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can update their own summaries" ON public.books
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own summaries" ON public.books
  FOR DELETE
  USING (auth.uid() = user_id);

-- Progress helper function
CREATE OR REPLACE FUNCTION public.increment_progress(book_id uuid, delta numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.books
  SET progress_percent = least(100, greatest(0, coalesce(progress_percent, 0) + delta))
  WHERE id = book_id
    AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_progress(uuid, numeric) TO authenticated;

-- ============================================
-- 2. USER ROLES: User profiles and editor system
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_editor boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Editors can insert profiles" ON public.user_profiles;

CREATE POLICY "Users can read their own profile" ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Editors can insert profiles" ON public.user_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_editor = true
    )
  );

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, is_editor)
  VALUES (new.id, false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Add is_editor_created column to books
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS is_editor_created boolean NOT NULL DEFAULT false;

-- Update books RLS policy to allow editors to see all books
DROP POLICY IF EXISTS "Anyone can select public summaries" ON public.books;
CREATE POLICY "Anyone can select public summaries" ON public.books
  FOR SELECT
  USING (
    is_public = true 
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_editor = true
    )
  );

-- User library table
CREATE TABLE IF NOT EXISTS public.user_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);

ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own library" ON public.user_library;
CREATE POLICY "Users can manage their own library" ON public.user_library
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_editor ON public.user_profiles(is_editor);
CREATE INDEX IF NOT EXISTS idx_books_is_editor_created ON public.books(is_editor_created);
CREATE INDEX IF NOT EXISTS idx_user_library_user_id ON public.user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_book_id ON public.user_library(book_id);

-- ============================================
-- 3. BOOK COLUMNS: Additional book fields
-- ============================================

-- Local file path
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS local_file_path TEXT;

COMMENT ON COLUMN public.books.local_file_path IS 'Local file system path to the original book file for additional analysis';

-- Analysis columns
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS analysis_results JSONB;

ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.books.analysis_results IS 'JSON data containing the results of book analysis (completeness, comprehensive, comparison)';
COMMENT ON COLUMN public.books.last_analyzed_at IS 'Timestamp of when the book was last analyzed for completeness and accuracy';

-- Indexes for analysis
CREATE INDEX IF NOT EXISTS idx_books_local_file_path ON public.books(local_file_path) WHERE local_file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_last_analyzed_at ON public.books(last_analyzed_at) WHERE last_analyzed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_analysis_results ON public.books USING GIN(analysis_results) WHERE analysis_results IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_is_public ON public.books(is_public);
CREATE INDEX IF NOT EXISTS idx_books_public_created_at ON public.books(is_public, created_at DESC) WHERE is_public = true;

-- ============================================
-- 4. HIGHLIGHTS: User highlights system
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_highlights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  item_index INTEGER NOT NULL DEFAULT 0,
  highlighted_text TEXT NOT NULL,
  context_text TEXT,
  start_offset INTEGER,
  end_offset INTEGER,
  color TEXT DEFAULT 'yellow',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id, section, item_index, start_offset, end_offset)
);

CREATE INDEX IF NOT EXISTS idx_user_highlights_user_id ON public.user_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_highlights_book_id ON public.user_highlights(book_id);
CREATE INDEX IF NOT EXISTS idx_user_highlights_section ON public.user_highlights(section);
CREATE INDEX IF NOT EXISTS idx_user_highlights_created_at ON public.user_highlights(created_at DESC);

ALTER TABLE public.user_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own highlights" ON public.user_highlights;
DROP POLICY IF EXISTS "Users can insert their own highlights" ON public.user_highlights;
DROP POLICY IF EXISTS "Users can update their own highlights" ON public.user_highlights;
DROP POLICY IF EXISTS "Users can delete their own highlights" ON public.user_highlights;

CREATE POLICY "Users can view their own highlights" ON public.user_highlights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own highlights" ON public.user_highlights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own highlights" ON public.user_highlights
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights" ON public.user_highlights
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_highlights IS 'User-created highlights for book summaries';
COMMENT ON COLUMN public.user_highlights.color IS 'Color of the highlight (yellow, green, blue, pink, purple, orange)';

-- ============================================
-- 5. FOLDERS: User folders for organizing highlights
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'blue',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS public.folder_highlights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.user_folders(id) ON DELETE CASCADE,
  highlight_id UUID NOT NULL REFERENCES public.user_highlights(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(folder_id, highlight_id)
);

CREATE INDEX IF NOT EXISTS idx_user_folders_user_id ON public.user_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folder_highlights_folder_id ON public.folder_highlights(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_highlights_highlight_id ON public.folder_highlights(highlight_id);
CREATE INDEX IF NOT EXISTS idx_user_folders_created_at ON public.user_folders(created_at DESC);

ALTER TABLE public.user_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own folders" ON public.user_folders;
DROP POLICY IF EXISTS "Users can insert their own folders" ON public.user_folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.user_folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.user_folders;

CREATE POLICY "Users can view their own folders" ON public.user_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders" ON public.user_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders" ON public.user_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" ON public.user_folders
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view folder highlights for their folders" ON public.folder_highlights;
DROP POLICY IF EXISTS "Users can insert folder highlights for their folders" ON public.folder_highlights;
DROP POLICY IF EXISTS "Users can delete folder highlights for their folders" ON public.folder_highlights;

CREATE POLICY "Users can view folder highlights for their folders" ON public.folder_highlights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_folders 
      WHERE user_folders.id = folder_highlights.folder_id 
      AND user_folders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert folder highlights for their folders" ON public.folder_highlights
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_folders 
      WHERE user_folders.id = folder_highlights.folder_id 
      AND user_folders.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_highlights 
      WHERE user_highlights.id = folder_highlights.highlight_id 
      AND user_highlights.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete folder highlights for their folders" ON public.folder_highlights
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_folders 
      WHERE user_folders.id = folder_highlights.folder_id 
      AND user_folders.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.user_folders IS 'User-created folders for organizing highlights';
COMMENT ON TABLE public.folder_highlights IS 'Junction table linking folders to highlights';

-- ============================================
-- 6. READ & FAVORITES: User reading tracking
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_read_books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  favorited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_user_read_books_user_id ON public.user_read_books(user_id);
CREATE INDEX IF NOT EXISTS idx_user_read_books_book_id ON public.user_read_books(book_id);
CREATE INDEX IF NOT EXISTS idx_user_read_books_read_at ON public.user_read_books(read_at);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_book_id ON public.user_favorites(book_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_favorited_at ON public.user_favorites(favorited_at);

ALTER TABLE public.user_read_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own read books" ON public.user_read_books;
DROP POLICY IF EXISTS "Users can insert their own read books" ON public.user_read_books;
DROP POLICY IF EXISTS "Users can delete their own read books" ON public.user_read_books;

CREATE POLICY "Users can view their own read books" ON public.user_read_books
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own read books" ON public.user_read_books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own read books" ON public.user_read_books
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own favorites" ON public.user_favorites;
DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.user_favorites;
DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.user_favorites;

CREATE POLICY "Users can view their own favorites" ON public.user_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites" ON public.user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" ON public.user_favorites
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_read_books IS 'Tracks books that users have marked as read';
COMMENT ON TABLE public.user_favorites IS 'Tracks books that users have favorited';
COMMENT ON COLUMN public.user_read_books.read_at IS 'When the user marked the book as read';
COMMENT ON COLUMN public.user_favorites.favorited_at IS 'When the user added the book to favorites';

-- ============================================
-- 7. SUMMARY RATINGS: Editor rating system
-- ============================================

CREATE TABLE IF NOT EXISTS public.summary_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_summary_ratings_user_id ON public.summary_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_summary_ratings_book_id ON public.summary_ratings(book_id);
CREATE INDEX IF NOT EXISTS idx_summary_ratings_rating ON public.summary_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_summary_ratings_created_at ON public.summary_ratings(created_at DESC);

ALTER TABLE public.summary_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Editors can view all ratings" ON public.summary_ratings;
DROP POLICY IF EXISTS "Editors can insert their own ratings" ON public.summary_ratings;
DROP POLICY IF EXISTS "Editors can update their own ratings" ON public.summary_ratings;
DROP POLICY IF EXISTS "Editors can delete their own ratings" ON public.summary_ratings;

CREATE POLICY "Editors can view all ratings" ON public.summary_ratings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_editor = true
    )
  );

CREATE POLICY "Editors can insert their own ratings" ON public.summary_ratings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_editor = true
    )
  );

CREATE POLICY "Editors can update their own ratings" ON public.summary_ratings
  FOR UPDATE USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_editor = true
    )
  );

CREATE POLICY "Editors can delete their own ratings" ON public.summary_ratings
  FOR DELETE USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_editor = true
    )
  );

COMMENT ON TABLE public.summary_ratings IS 'Allows editors to rate the quality of book summaries (1-10 scale)';

-- ============================================
-- 8. SAVED PROMPTS: User prompt storage
-- ============================================

CREATE TABLE IF NOT EXISTS public.saved_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  ratings INTEGER[] DEFAULT '{}'::integer[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_id ON public.saved_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_prompts_created_at ON public.saved_prompts(created_at DESC);

ALTER TABLE public.saved_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own prompts" ON public.saved_prompts;
DROP POLICY IF EXISTS "Users can insert their own prompts" ON public.saved_prompts;
DROP POLICY IF EXISTS "Users can update their own prompts" ON public.saved_prompts;
DROP POLICY IF EXISTS "Users can delete their own prompts" ON public.saved_prompts;

CREATE POLICY "Users can view their own prompts" ON public.saved_prompts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own prompts" ON public.saved_prompts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompts" ON public.saved_prompts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompts" ON public.saved_prompts
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.saved_prompts IS 'Stores user-saved prompts for book summarization';

-- ============================================
-- Setup Complete!
-- ============================================
-- Next steps:
-- 1. Create storage buckets: 'book-files' and 'audio' (both public)
-- 2. Run storage-policies.sql to set up storage policies
-- 3. Update your .env.local with Supabase credentials
-- ============================================
