-- Administrator-managed coupon codes. Each grants video library access for access_days.
-- The original FREE_ACCESS_CODE_HASH secret continues to work alongside these codes.
CREATE TABLE coupon_codes (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  access_days INTEGER NOT NULL DEFAULT 365 CHECK (access_days BETWEEN 1 AND 3650),
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  expires_at INTEGER,
  disabled_at INTEGER,
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX coupon_codes_code ON coupon_codes(code COLLATE NOCASE);
CREATE TABLE coupon_redemptions (
  coupon_id TEXT NOT NULL REFERENCES coupon_codes(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  redeemed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (coupon_id,user_id)
);
CREATE INDEX coupon_redemptions_user ON coupon_redemptions(user_id);
