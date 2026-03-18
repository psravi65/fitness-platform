-- Migration 002: Add agent reviews to plans table
-- Run with: wrangler d1 migrations apply DB --remote

ALTER TABLE plans ADD COLUMN agent_reviews_json TEXT;
