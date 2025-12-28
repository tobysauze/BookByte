-- Migration: Add summary_ratings table for editors to rate summaries
-- This allows editors to rate the quality of summaries (1-10)

CREATE TABLE IF NOT EXISTS public.summary_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  notes TEXT, -- Optional notes about the rating
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id) -- One rating per editor per book
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_summary_ratings_user_id ON public.summary_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_summary_ratings_book_id ON public.summary_ratings(book_id);
CREATE INDEX IF NOT EXISTS idx_summary_ratings_rating ON public.summary_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_summary_ratings_created_at ON public.summary_ratings(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.summary_ratings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for summary_ratings
-- Editors can view all ratings
CREATE POLICY "Editors can view all ratings" ON public.summary_ratings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_editor = true
    )
  );

-- Editors can insert their own ratings
CREATE POLICY "Editors can insert their own ratings" ON public.summary_ratings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_editor = true
    )
  );

-- Editors can update their own ratings
CREATE POLICY "Editors can update their own ratings" ON public.summary_ratings
  FOR UPDATE USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_editor = true
    )
  );

-- Editors can delete their own ratings
CREATE POLICY "Editors can delete their own ratings" ON public.summary_ratings
  FOR DELETE USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_editor = true
    )
  );

-- Add comment
COMMENT ON TABLE public.summary_ratings IS 'Allows editors to rate the quality of book summaries (1-10 scale)';




