-- Learners confirm their email before purchasing, redeeming coupons or opening courses.
-- Accounts that existed before this migration are treated as already verified.
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
UPDATE users SET email_verified_at=unixepoch() WHERE email_verified_at IS NULL;
CREATE TABLE email_verification_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX email_verification_user ON email_verification_tokens(user_id,created_at);
