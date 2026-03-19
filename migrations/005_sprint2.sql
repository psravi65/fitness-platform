-- Sprint 2 migration — run in Cloudflare D1 Console

-- Soft delete on clients
ALTER TABLE clients ADD COLUMN deleted_at TEXT;

-- Plan versioning
ALTER TABLE plans ADD COLUMN archived_version INTEGER;

-- Plan notification flag
ALTER TABLE plans ADD COLUMN plan_notified INTEGER DEFAULT 1;

-- Gym billing fields
ALTER TABLE gyms ADD COLUMN plan_tier TEXT DEFAULT 'trial';
ALTER TABLE gyms ADD COLUMN trial_ends_at TEXT;

-- Update existing gyms to have trial fields
UPDATE gyms SET plan_tier = 'trial', trial_ends_at = datetime('now', '+30 days') WHERE plan_tier IS NULL;
