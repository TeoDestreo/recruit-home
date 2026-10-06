-- No existing login or enrollment automatically grants paid access.
CREATE TABLE course_access (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT REFERENCES courses(id),
  payment_reference TEXT NOT NULL UNIQUE,
  granted_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER,
  revoked_at INTEGER,
  CHECK (expires_at IS NULL OR expires_at > granted_at)
);
CREATE INDEX course_access_user ON course_access(user_id,course_id);
-- NULL course_id represents paid library access. Only the future verified
-- payment handler or an authorized administrator may insert entitlement rows.
