-- Migration: Add analysis-related columns to books table
-- This migration adds columns to store analysis results and metadata

-- Add analysis_results column to store analysis data
ALTER TABLE public.books 
ADD COLUMN analysis_results JSONB;

-- Add last_analyzed_at column to track when analysis was last performed
ALTER TABLE public.books 
ADD COLUMN last_analyzed_at TIMESTAMP WITH TIME ZONE;

-- Add comments to explain the columns' purposes
COMMENT ON COLUMN public.books.analysis_results IS 'JSON data containing the results of book analysis (completeness, comprehensive, comparison)';
COMMENT ON COLUMN public.books.last_analyzed_at IS 'Timestamp of when the book was last analyzed for completeness and accuracy';

-- Create an index for faster lookups on analysis timestamp
CREATE INDEX IF NOT EXISTS idx_books_last_analyzed_at ON public.books(last_analyzed_at) WHERE last_analyzed_at IS NOT NULL;

-- Create an index for analysis results queries
CREATE INDEX IF NOT EXISTS idx_books_analysis_results ON public.books USING GIN(analysis_results) WHERE analysis_results IS NOT NULL;






