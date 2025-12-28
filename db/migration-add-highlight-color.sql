-- Migration: Add color column to user_highlights table
-- This allows users to choose custom colors for their highlights

ALTER TABLE public.user_highlights 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'yellow';

-- Update existing highlights to have yellow color
UPDATE public.user_highlights 
SET color = 'yellow' 
WHERE color IS NULL;

-- Add comment
COMMENT ON COLUMN public.user_highlights.color IS 'Color of the highlight (yellow, green, blue, pink, purple, orange)';






