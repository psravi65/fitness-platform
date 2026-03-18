-- Migration 004: Multi-tenant gym support
-- Adds gyms table, gym_id to clients and users, superadmin role
-- Existing data assigned to a default "Gym 1"

-- 1. Create gyms table
CREATE TABLE IF NOT EXISTS gyms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insert default gym for existing data
INSERT INTO gyms (id, name, owner_name, status)
VALUES ('gym_default_001', 'Gym 1', 'Owner', 'active');

-- 3. Add gym_id to clients
ALTER TABLE clients ADD COLUMN gym_id TEXT DEFAULT 'gym_default_001';

-- 4. Add gym_id to users (admins belong to a gym; superadmin has NULL gym_id)
ALTER TABLE users ADD COLUMN gym_id TEXT;

-- 5. Assign all existing admin users to the default gym
UPDATE users SET gym_id = 'gym_default_001' WHERE role = 'admin';

-- 6. Add superadmin role support (CHECK constraint can't be altered, handled in app logic)

CREATE INDEX IF NOT EXISTS idx_clients_gym_id ON clients(gym_id);
CREATE INDEX IF NOT EXISTS idx_users_gym_id ON users(gym_id);
