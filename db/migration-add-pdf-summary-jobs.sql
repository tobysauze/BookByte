-- Create a simple job table for long-running PDF summarization tasks.
-- This is intended to be written/read only by server-side admin code.

create table if not exists public.pdf_summary_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null check (status in ('queued', 'running', 'done', 'error')),
  source_url text,
  source_file_name text,
  title text,
  author text,
  model text,
  prompt_version text,
  result_text text,
  error_message text
);

create index if not exists pdf_summary_jobs_status_created_at_idx
  on public.pdf_summary_jobs (status, created_at desc);

alter table public.pdf_summary_jobs enable row level security;

-- Intentionally no RLS policies. Only service-role/admin should access this table.

