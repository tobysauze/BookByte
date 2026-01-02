-- Ensure user_highlights table exists
-- Run this in your Supabase SQL Editor

-- Create user_highlights table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_highlights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  section TEXT NOT NULL, -- e.g., "quick_summary", "raw_text", etc.
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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_highlights_user_id ON public.user_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_highlights_book_id ON public.user_highlights(book_id);
CREATE INDEX IF NOT EXISTS idx_user_highlights_section ON public.user_highlights(section);

-- Enable RLS
ALTER TABLE public.user_highlights ENABLE ROW LEVEL SECURITY;

-- Re-create policies to ensure they are correct (dropping if exists first avoids errors if policies already exist with different definitions, but for safety with IF NOT EXISTS logic we can just use DO block or just attempt creation which might fail if exists. Simpler to just use standard policy creation which fails if exists, user can ignore "already exists" errors)

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'user_highlights' AND policyname = 'Users can view their own highlights') THEN
        CREATE POLICY "Users can view their own highlights" ON public.user_highlights FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'user_highlights' AND policyname = 'Users can insert their own highlights') THEN
        CREATE POLICY "Users can insert their own highlights" ON public.user_highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'user_highlights' AND policyname = 'Users can update their own highlights') THEN
        CREATE POLICY "Users can update their own highlights" ON public.user_highlights FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'user_highlights' AND policyname = 'Users can delete their own highlights') THEN
        CREATE POLICY "Users can delete their own highlights" ON public.user_highlights FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;
