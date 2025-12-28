-- Storage policies for Supabase
-- Run these in your Supabase dashboard under Storage > Policies

-- Policy for book-files bucket: Users can upload their own files
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'book-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy for book-files bucket: Users can read their own files
CREATE POLICY "Users can read their own files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'book-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy for book-files bucket: Anyone can read public files
CREATE POLICY "Anyone can read public files" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'book-files');

-- Policy for audio bucket: Users can upload their own files
CREATE POLICY "Users can upload audio files" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'audio' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy for audio bucket: Users can read their own files
CREATE POLICY "Users can read audio files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'audio' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy for audio bucket: Anyone can read public files
CREATE POLICY "Anyone can read audio files" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'audio');






