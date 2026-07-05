-- Migration: Security scan results storage

BEGIN;

ALTER TABLE client_audits ADD COLUMN IF NOT EXISTS scan_type VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_client_audits_scan_type ON client_audits(scan_type);

COMMIT;
