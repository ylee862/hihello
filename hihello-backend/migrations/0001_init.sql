CREATE TABLE IF NOT EXISTS postcards (
  token              TEXT PRIMARY KEY,
  sender_email       TEXT NOT NULL,
  message            TEXT NOT NULL,
  postcard_design_id TEXT,
  photos             TEXT NOT NULL DEFAULT '[]',
  created_at         INTEGER NOT NULL,
  scheduled_at       INTEGER NOT NULL 
);
