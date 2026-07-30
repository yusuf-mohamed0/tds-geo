CREATE TABLE IF NOT EXISTS oauth_states (
  id SERIAL PRIMARY KEY,
  state VARCHAR(255) UNIQUE NOT NULL,
  code_verifier VARCHAR(255) NOT NULL,
  redirect_uri VARCHAR(512) DEFAULT '/admin',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);

-- Cleanup expired states (older than 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_oauth_states() RETURNS trigger AS $$
BEGIN
  DELETE FROM oauth_states WHERE created_at < NOW() - INTERVAL '10 minutes';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_oauth_states ON oauth_states;
CREATE TRIGGER trigger_cleanup_oauth_states
  AFTER INSERT ON oauth_states
  EXECUTE FUNCTION cleanup_oauth_states();
