-- Migration 008: Add missing indexes and rate_limits TTL cleanup

-- Index for time-based compliance and audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Index for soft-deleted clients (common filter)
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients(deleted_at);

-- Index for rate_limits TTL cleanup (expire old rows by window_start)
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- Purge stale rate_limit rows older than 1 hour to keep the table small.
-- This runs at migration time; in production, schedule periodic cleanup or
-- call DELETE FROM rate_limits WHERE window_start < datetime('now', '-1 hour')
-- from a CRON Worker.
DELETE FROM rate_limits WHERE window_start < datetime('now', '-1 hour');
