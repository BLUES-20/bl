-- Migration: Add password reset columns to users table
-- This adds the necessary columns for the forgot password functionality

ALTER TABLE users
ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reset_password_token ON users(reset_password_token);

-- Verify columns exist
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;
