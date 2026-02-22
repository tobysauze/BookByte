-- Migration: Add reading_positions table for cross-device reading position sync

CREATE TABLE IF NOT EXISTS reading_positions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  position JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_positions_user_id ON reading_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_positions_book_id ON reading_positions(book_id);

ALTER TABLE reading_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reading positions" ON reading_positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own reading positions" ON reading_positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading positions" ON reading_positions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reading positions" ON reading_positions
  FOR DELETE USING (auth.uid() = user_id);
