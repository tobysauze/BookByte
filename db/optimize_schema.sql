-- Add new optimized columns to books table
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Non-Fiction';

-- Create a function to backfill data
CREATE OR REPLACE FUNCTION backfill_book_metadata() RETURNS void AS $$
DECLARE
    r RECORD;
    summary_json JSONB;
    raw_text TEXT;
    quick_summary TEXT;
    short_summary TEXT;
    target_description TEXT;
    target_word_count INTEGER;
    target_category TEXT;
    text_to_analyze TEXT;
BEGIN
    FOR r IN SELECT id, summary FROM public.books LOOP
        summary_json := r.summary;
        
        -- Extract text content
        -- Note: using ->> returns text, -> returns jsonb
        raw_text := summary_json ->> 'raw_text';
        quick_summary := summary_json ->> 'quick_summary';
        short_summary := summary_json ->> 'short_summary';
        
        -- 1. Determine Description
        IF short_summary IS NOT NULL AND length(short_summary) > 0 THEN
            target_description := short_summary;
        ELSIF quick_summary IS NOT NULL AND length(quick_summary) > 0 THEN
            target_description := substring(quick_summary from 1 for 200) || '...';
        ELSIF raw_text IS NOT NULL AND length(raw_text) > 0 THEN
            target_description := substring(raw_text from 1 for 200) || '...';
        ELSE
            target_description := 'No description available.';
        END IF;

        -- 2. Determine Word Count (Estimation)
        IF raw_text IS NOT NULL THEN
             -- Rough word count estimation: length / 6 (avg word length + space)
             -- Postgres array_length(regexp_split_to_array(trim(raw_text), '\s+'), 1) is better but slower
            target_word_count := array_length(regexp_split_to_array(trim(raw_text), '\s+'), 1);
        ELSE
            target_word_count := 0;
        END IF;

        -- 3. Determine Category
        text_to_analyze := lower(coalesce(raw_text, quick_summary, ''));
        
        IF text_to_analyze LIKE '%psychology%' OR text_to_analyze LIKE '%mind%' OR text_to_analyze LIKE '%consciousness%' THEN
            target_category := 'Psychology';
        ELSIF text_to_analyze LIKE '%leadership%' OR text_to_analyze LIKE '%management%' OR text_to_analyze LIKE '%business%' THEN
            target_category := 'Management/Leadership';
        ELSIF text_to_analyze LIKE '%productivity%' OR text_to_analyze LIKE '%workflow%' THEN
            target_category := 'Productivity';
        ELSIF text_to_analyze LIKE '%self-help%' OR text_to_analyze LIKE '%personal development%' THEN
            target_category := 'Self-Help';
        ELSE
            target_category := 'Non-Fiction';
        END IF;

        -- Update the record
        UPDATE public.books 
        SET 
            word_count = target_word_count,
            description = target_description,
            category = target_category
        WHERE id = r.id;
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the backfill
SELECT backfill_book_metadata();

-- Drop the function after use (optional, keeping it doesn't hurt)
DROP FUNCTION backfill_book_metadata();
