-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- ──────────────────────────────────────────────
-- Google OAuth: add google_id column to users
-- ──────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
