ALTER TABLE courses ADD COLUMN youtube_id TEXT;
ALTER TABLE media_uploads ADD COLUMN expected_revision INTEGER NOT NULL DEFAULT -1;
ALTER TABLE media_uploads ADD COLUMN progress_mode TEXT NOT NULL DEFAULT 'reset';
CREATE TABLE video_history(id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id),user_id TEXT NOT NULL REFERENCES users(id),asset_key TEXT,youtube_id TEXT,duration_seconds REAL NOT NULL,progress_mode TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE video_progress_archive(change_id TEXT NOT NULL REFERENCES video_history(id),user_id TEXT NOT NULL,course_id TEXT NOT NULL,position_seconds REAL NOT NULL,watched_seconds REAL NOT NULL,watched_ranges TEXT NOT NULL,PRIMARY KEY(change_id,user_id));
