-- Complete Migration: Add all analysis-related columns to books table
-- This migration adds all necessary columns for the book analysis system

-- Add local_file_path column to store the local file path for analysis
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS local_file_path TEXT;

-- Add analysis_results column to store analysis data
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS analysis_results JSONB;

-- Add last_analyzed_at column to track when analysis was last performed
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMP WITH TIME ZONE;

-- Add comments to explain the columns' purposes
COMMENT ON COLUMN public.books.local_file_path IS 'Local file system path to the original book file for additional analysis';
COMMENT ON COLUMN public.books.analysis_results IS 'JSON data containing the results of book analysis (completeness, comprehensive, comparison)';
COMMENT ON COLUMN public.books.last_analyzed_at IS 'Timestamp of when the book was last analyzed for completeness and accuracy';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_books_local_file_path ON public.books(local_file_path) WHERE local_file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_last_analyzed_at ON public.books(last_analyzed_at) WHERE last_analyzed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_analysis_results ON public.books USING GIN(analysis_results) WHERE analysis_results IS NOT NULL;

-- Verify the columns were added successfully
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'books' 
AND column_name IN ('local_file_path', 'analysis_results', 'last_analyzed_at')
ORDER BY column_name;






