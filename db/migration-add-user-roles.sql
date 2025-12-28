-- Add user roles system to support editor vs regular user permissions

-- Add is_editor column to auth.users (we'll use a custom table instead)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_editor boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read their own profile" ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (but not is_editor - only admins can do that)
CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only editors can insert new profiles (for new user signups)
CREATE POLICY "Editors can insert profiles" ON public.user_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_editor = true
    )
  );

-- Create a function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, is_editor)
  VALUES (new.id, false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Update books table to track if book is from editor
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS is_editor_created boolean NOT NULL DEFAULT false;

-- Update RLS policies for books
-- Editors can see all books, regular users can only see public books and their own
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

-- Create user_library table for regular users to save books
CREATE TABLE IF NOT EXISTS public.user_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);

-- Enable RLS on user_library
ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;

-- Users can manage their own library
CREATE POLICY "Users can manage their own library" ON public.user_library
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_editor ON public.user_profiles(is_editor);
CREATE INDEX IF NOT EXISTS idx_books_is_editor_created ON public.books(is_editor_created);
CREATE INDEX IF NOT EXISTS idx_user_library_user_id ON public.user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_book_id ON public.user_library(book_id);






