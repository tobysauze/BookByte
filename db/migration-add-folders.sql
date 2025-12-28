-- Migration: Add user folders system for organizing highlights
-- This allows users to create custom folders and organize their highlights

-- Create user_folders table
CREATE TABLE IF NOT EXISTS public.user_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'blue', -- Color theme for the folder
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name) -- Prevent duplicate folder names per user
);

-- Create folder_highlights junction table (many-to-many)
CREATE TABLE IF NOT EXISTS public.folder_highlights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.user_folders(id) ON DELETE CASCADE,
  highlight_id UUID NOT NULL REFERENCES public.user_highlights(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(folder_id, highlight_id) -- Prevent duplicate assignments
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_folders_user_id ON public.user_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folder_highlights_folder_id ON public.folder_highlights(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_highlights_highlight_id ON public.folder_highlights(highlight_id);
CREATE INDEX IF NOT EXISTS idx_user_folders_created_at ON public.user_folders(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_highlights ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_folders
CREATE POLICY "Users can view their own folders" ON public.user_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders" ON public.user_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders" ON public.user_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" ON public.user_folders
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for folder_highlights
CREATE POLICY "Users can view folder highlights for their folders" ON public.folder_highlights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_folders 
      WHERE user_folders.id = folder_highlights.folder_id 
      AND user_folders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert folder highlights for their folders" ON public.folder_highlights
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_folders 
      WHERE user_folders.id = folder_highlights.folder_id 
      AND user_folders.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_highlights 
      WHERE user_highlights.id = folder_highlights.highlight_id 
      AND user_highlights.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete folder highlights for their folders" ON public.folder_highlights
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_folders 
      WHERE user_folders.id = folder_highlights.folder_id 
      AND user_folders.user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE public.user_folders IS 'User-created folders for organizing highlights';
COMMENT ON TABLE public.folder_highlights IS 'Junction table linking folders to highlights';






