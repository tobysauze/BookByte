-- Migration: Add short_summary field to books table
-- Run this in your Supabase SQL editor

-- Add the short_summary column to the books table
-- This will be a JSONB field that gets added to the existing summary JSONB column
-- We'll update existing records to have a default short_summary

-- First, let's add a default short_summary to existing books
UPDATE public.books 
SET summary = jsonb_set(
  summary, 
  '{short_summary}', 
  to_jsonb(substring(summary->>'quick_summary', 1, 200) || '...')
)
WHERE summary ? 'quick_summary' 
  AND NOT (summary ? 'short_summary');

-- Optional: If you want to delete all existing books and start fresh, uncomment this:
-- DELETE FROM public.books;

-- Note: The short_summary field will be automatically added to new books
-- through the updated AI prompts in the application code.






