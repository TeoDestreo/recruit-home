-- Captions (WebVTT) and plain-text transcripts for video courses. Kept in D1, not R2:
-- they are small text files and are served only to learners with course access.
CREATE TABLE course_captions (
  course_id TEXT PRIMARY KEY NOT NULL REFERENCES courses(id),
  vtt TEXT,
  transcript TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT REFERENCES users(id),
  CHECK (vtt IS NOT NULL OR transcript IS NOT NULL)
);
