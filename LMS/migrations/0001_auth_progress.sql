-- Apply after schema.sql using Wrangler D1 migrations (tracked once per database).
-- Existing users remain unable to use password login until a hash is assigned.
ALTER TABLE users ADD COLUMN password_hash TEXT;
CREATE UNIQUE INDEX users_email_case_insensitive ON users(email COLLATE NOCASE);

-- Store a SHA-256 digest of the random session token, never the cookie itself.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);

-- Resume position is distinct from watched time; seeking is not completion.
CREATE TABLE course_progress (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  position_seconds REAL NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
  watched_seconds REAL NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, course_id),
  FOREIGN KEY (user_id, course_id) REFERENCES enrollments(user_id, course_id)
);
CREATE UNIQUE INDEX certificates_user_course ON certificates(user_id, course_id);

-- Preserve certificate display details even if names or course titles change later.
ALTER TABLE certificates ADD COLUMN learner_name TEXT;
ALTER TABLE certificates ADD COLUMN course_title TEXT;
ALTER TABLE certificates ADD COLUMN completed_at TEXT;
UPDATE certificates SET
  learner_name = (SELECT name FROM users WHERE users.id = certificates.user_id),
  course_title = (SELECT title FROM courses WHERE courses.id = certificates.course_id),
  completed_at = (SELECT completed_at FROM enrollments
    WHERE enrollments.user_id = certificates.user_id AND enrollments.course_id = certificates.course_id);

CREATE TRIGGER certificates_require_completion
BEFORE INSERT ON certificates
WHEN NOT EXISTS (SELECT 1 FROM enrollments
  WHERE user_id = NEW.user_id AND course_id = NEW.course_id AND completed_at IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'Course completion is required before certificate issuance');
END;
