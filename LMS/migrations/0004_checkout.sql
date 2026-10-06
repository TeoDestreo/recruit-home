CREATE TABLE IF NOT EXISTS checkout_orders (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  paypal_order_id TEXT UNIQUE,
  capture_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'CREATED',
  amount TEXT NOT NULL DEFAULT '100.00',
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS checkout_user ON checkout_orders(user_id, created_at);
