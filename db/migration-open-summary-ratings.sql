-- Migration: Open summary_ratings to all authenticated users (not just editors)
-- Previously only editors could rate summaries, now all logged-in users can

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Editors can view all ratings" ON public.summary_ratings;
DROP POLICY IF EXISTS "Editors can insert their own ratings" ON public.summary_ratings;
DROP POLICY IF EXISTS "Editors can update their own ratings" ON public.summary_ratings;
DROP POLICY IF EXISTS "Editors can delete their own ratings" ON public.summary_ratings;

-- New policies: all authenticated users can rate
CREATE POLICY "Users can view all ratings" ON public.summary_ratings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own ratings" ON public.summary_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON public.summary_ratings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" ON public.summary_ratings
  FOR DELETE USING (auth.uid() = user_id);
