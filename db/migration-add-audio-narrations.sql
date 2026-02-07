-- Migration: Add shared audio narrations table
-- Stores ElevenLabs-generated narration URLs so narrations can be reused by all users.

CREATE TABLE IF NOT EXISTS public.book_audio_narrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(book_id, section, voice_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_book_audio_narrations_book_id ON public.book_audio_narrations(book_id);
CREATE INDEX IF NOT EXISTS idx_book_audio_narrations_created_at ON public.book_audio_narrations(created_at DESC);

ALTER TABLE public.book_audio_narrations ENABLE ROW LEVEL SECURITY;

-- Anyone who can see the book can see its narrations.
CREATE POLICY "Users can view narrations for accessible books" ON public.book_audio_narrations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.books b
      WHERE b.id = book_audio_narrations.book_id
        AND (
          b.is_public = TRUE
          OR b.user_id = auth.uid()
        )
    )
  );

-- Allow creation only when the user can access the book (public or owned).
CREATE POLICY "Users can create narrations for accessible books" ON public.book_audio_narrations
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.books b
      WHERE b.id = book_audio_narrations.book_id
        AND (
          b.is_public = TRUE
          OR b.user_id = auth.uid()
        )
    )
  );

-- No updates needed; narrations are append-only (new rows per voice/model/section).

COMMENT ON TABLE public.book_audio_narrations IS 'Cached audio narrations for book summary sections, shared across users';

