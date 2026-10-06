ALTER TABLE courses ADD COLUMN duration_seconds REAL NOT NULL DEFAULT 0 CHECK(duration_seconds >= 0);
ALTER TABLE course_progress ADD COLUMN watched_ranges TEXT NOT NULL DEFAULT '[]';
ALTER TABLE course_progress ADD COLUMN playback_token TEXT;
ALTER TABLE course_progress ADD COLUMN last_position REAL NOT NULL DEFAULT 0;
ALTER TABLE course_progress ADD COLUMN heartbeat_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE course_progress ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE TABLE auth_limits (
  key TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
