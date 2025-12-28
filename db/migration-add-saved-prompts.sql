-- Migration: Add saved_prompts table for storing user prompts
-- This allows prompts to persist across devices, browsers, and server restarts

CREATE TABLE IF NOT EXISTS public.saved_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  ratings INTEGER[] DEFAULT '{}'::integer[], -- Array of ratings (1-10)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name) -- One prompt per user per name
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_id ON public.saved_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_prompts_created_at ON public.saved_prompts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.saved_prompts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for saved_prompts
-- Users can view their own prompts
CREATE POLICY "Users can view their own prompts" ON public.saved_prompts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own prompts
CREATE POLICY "Users can insert their own prompts" ON public.saved_prompts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own prompts
CREATE POLICY "Users can update their own prompts" ON public.saved_prompts
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own prompts
CREATE POLICY "Users can delete their own prompts" ON public.saved_prompts
  FOR DELETE USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.saved_prompts IS 'Stores user-saved prompts for book summarization';




