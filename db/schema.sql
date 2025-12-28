-- BookByte database schema
-- Run this against your Supabase project (SQL editor or migrations).

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  author text,
  cover_url text,
  file_url text,
  summary jsonb not null,
  audio_urls jsonb not null default '{}'::jsonb,
  progress_percent numeric(5,2) default 0,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

create policy "Users can insert their own summaries" on public.books
  for insert
  with check (auth.uid() = user_id);

create policy "Users can select their own summaries" on public.books
  for select
  using (auth.uid() = user_id);

create policy "Anyone can select public summaries" on public.books
  for select
  using (is_public = true);

create policy "Users can update their own summaries" on public.books
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own summaries" on public.books
  for delete
  using (auth.uid() = user_id);

-- Optional: progress helpers
create or replace function public.increment_progress(book_id uuid, delta numeric)
returns void
language plpgsql
security definer set search_path = public as $$
begin
  update public.books
  set progress_percent = least(100, greatest(0, coalesce(progress_percent, 0) + delta))
  where id = book_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.increment_progress(uuid, numeric) to authenticated;

-- Storage buckets (execute in Storage policies)
-- Create buckets via Supabase dashboard if they don't exist:
--   book-files (public) for original uploads
--   audio (public) for generated mp3 files

-- Example storage policies (run separately in Storage policy editor):
-- policy name: "Users can upload their own files" on storage.objects
--   bucket_id = 'book-files'
--   for insert, with check (auth.uid() = owner);
-- policy name: "Users can read their files" on storage.objects
--   bucket_id in ('book-files', 'audio')
--   for select, using (auth.uid() = owner);

