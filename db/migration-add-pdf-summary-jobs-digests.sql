-- Add fields for high-quality multi-pass PDF summarization.
-- This avoids context-limit failures by first creating per-segment digests,
-- then generating the final deep-dive from those digests across multiple runs.

alter table public.pdf_summary_jobs
  add column if not exists stage text,
  add column if not exists stage_cursor integer,
  add column if not exists digest_parts jsonb;

