-- Migration: Add Shopify refresh token support
-- Adds columns for expiring OAuth tokens with refresh capability
-- Context: Shopify OAuth now uses expiring=1 to get refresh_token + expires_in

ALTER TABLE clients ADD COLUMN IF NOT EXISTS shopify_refresh_token VARCHAR(512);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS shopify_token_expires_at TIMESTAMPTZ;
