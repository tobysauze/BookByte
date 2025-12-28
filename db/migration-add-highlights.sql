-- Migration: Add user highlights table
-- This allows users to highlight text in book summaries

-- Create user_highlights table
CREATE TABLE IF NOT EXISTS public.user_highlights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  section TEXT NOT NULL, -- e.g., "quick_summary", "chapters", "key_ideas", etc.
  item_index INTEGER NOT NULL DEFAULT 0, -- Index within the section (for chapters, key_ideas, etc.)
  highlighted_text TEXT NOT NULL,
  context_text TEXT, -- Surrounding text for context
  start_offset INTEGER, -- Character offset in the text
  end_offset INTEGER, -- Character offset in the text
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id, section, item_index, start_offset, end_offset)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_highlights_user_id ON public.user_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_highlights_book_id ON public.user_highlights(book_id);
CREATE INDEX IF NOT EXISTS idx_user_highlights_section ON public.user_highlights(section);
CREATE INDEX IF NOT EXISTS idx_user_highlights_created_at ON public.user_highlights(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_highlights ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_highlights
CREATE POLICY "Users can view their own highlights" ON public.user_highlights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own highlights" ON public.user_highlights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own highlights" ON public.user_highlights
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights" ON public.user_highlights
  FOR DELETE USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.user_highlights IS 'User-created highlights for book summaries';






