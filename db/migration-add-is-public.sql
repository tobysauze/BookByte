-- Migration: Add is_public field to books table
-- Run this in your Supabase SQL editor

-- Add the is_public column to the books table
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Add RLS policy for public books
CREATE POLICY "Anyone can select public summaries" ON public.books
  FOR SELECT
  USING (is_public = true);

-- Optional: Create an index for better performance on public book queries
CREATE INDEX IF NOT EXISTS idx_books_is_public ON public.books(is_public);

-- Optional: Create a compound index for public books ordered by creation date
CREATE INDEX IF NOT EXISTS idx_books_public_created_at ON public.books(is_public, created_at DESC) 
WHERE is_public = true;






