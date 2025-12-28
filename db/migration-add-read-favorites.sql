-- Migration: Add user_read_books and user_favorites tables
-- This allows regular users to mark books as read and add them to favorites

-- Create user_read_books table
CREATE TABLE IF NOT EXISTS user_read_books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Create user_favorites table
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  favorited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_read_books_user_id ON user_read_books(user_id);
CREATE INDEX IF NOT EXISTS idx_user_read_books_book_id ON user_read_books(book_id);
CREATE INDEX IF NOT EXISTS idx_user_read_books_read_at ON user_read_books(read_at);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_book_id ON user_favorites(book_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_favorited_at ON user_favorites(favorited_at);

-- Enable Row Level Security
ALTER TABLE user_read_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_read_books
CREATE POLICY "Users can view their own read books" ON user_read_books
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own read books" ON user_read_books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own read books" ON user_read_books
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for user_favorites
CREATE POLICY "Users can view their own favorites" ON user_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites" ON user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" ON user_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE user_read_books IS 'Tracks books that users have marked as read';
COMMENT ON TABLE user_favorites IS 'Tracks books that users have favorited';
COMMENT ON COLUMN user_read_books.read_at IS 'When the user marked the book as read';
COMMENT ON COLUMN user_favorites.favorited_at IS 'When the user added the book to favorites';






