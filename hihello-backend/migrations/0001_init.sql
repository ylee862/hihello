CREATE TABLE IF NOT EXISTS postcards (
  token              TEXT PRIMARY KEY,
  message            TEXT NOT NULL,
  postcard_design_id TEXT,
  photos             TEXT NOT NULL DEFAULT '[]',
  created_at         INTEGER NOT NULL,
  scheduled_at       INTEGER NOT NULL   -- when the link is allowed to reveal its contents (created_at + 5 days)
);
