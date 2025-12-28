-- Migration: Add local_file_path column to books table
-- This migration adds a new column to store the local file path for original book files
-- This enables additional analysis capabilities on the complete original files

-- Add the local_file_path column
ALTER TABLE public.books 
ADD COLUMN local_file_path TEXT;

-- Add a comment to explain the column's purpose
COMMENT ON COLUMN public.books.local_file_path IS 'Local file system path to the original book file for additional analysis';

-- Create an index for faster lookups (optional)
CREATE INDEX IF NOT EXISTS idx_books_local_file_path ON public.books(local_file_path) WHERE local_file_path IS NOT NULL;






