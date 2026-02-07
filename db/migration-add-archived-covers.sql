-- Add archived_covers column to store previous cover URLs
-- This allows keeping old covers even after regeneration

ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS archived_covers JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.books.archived_covers IS 'Array of archived cover URLs with timestamps, stored as [{url: string, archived_at: timestamp, reason?: string}]';
