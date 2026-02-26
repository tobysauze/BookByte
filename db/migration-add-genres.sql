-- Create genres table with self-referencing parent_id for sub-genres
CREATE TABLE IF NOT EXISTS genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES genres(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_genres_parent_id ON genres(parent_id);

-- RLS
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "genres_select" ON genres FOR SELECT USING (true);

CREATE POLICY "genres_insert" ON genres FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_editor = true)
);

CREATE POLICY "genres_update" ON genres FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_editor = true)
);

CREATE POLICY "genres_delete" ON genres FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_editor = true)
);

-- Seed with existing categories as top-level genres
INSERT INTO genres (name) VALUES
  ('Arts / Design'),
  ('Biography / Memoir'),
  ('Business'),
  ('Career / Success'),
  ('Communication'),
  ('Economics'),
  ('Education'),
  ('Entertainment'),
  ('Entrepreneurship'),
  ('Fiction'),
  ('Food'),
  ('Health'),
  ('History'),
  ('Law'),
  ('Lifestyle'),
  ('Management / Leadership'),
  ('Marketing'),
  ('Media'),
  ('Money / Finance'),
  ('Motivation'),
  ('Parenting'),
  ('Philosophy'),
  ('Politics'),
  ('Productivity'),
  ('Psychology'),
  ('Relationships'),
  ('Sales'),
  ('Science'),
  ('Self-Improvement'),
  ('Society / Culture'),
  ('Spirituality'),
  ('Sports'),
  ('Technology')
ON CONFLICT (name) DO NOTHING;
