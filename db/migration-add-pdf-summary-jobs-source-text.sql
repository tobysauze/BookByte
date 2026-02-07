-- Allow the PDF summarization worker to persist extracted source text
-- so it can resume multi-chunk generation across multiple invocations.

alter table public.pdf_summary_jobs
  add column if not exists source_text text;

