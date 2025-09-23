-- Migration script to add encryption columns to existing tables
-- This preserves existing ID column types (VARCHAR for users, UUID for patients/providers)

-- Add hash columns to users table (ID is VARCHAR)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(255);

-- Add hash and PHI columns to patients table (ID is UUID)
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add hash and PHI columns to providers table (ID is UUID)
ALTER TABLE providers
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(255);

-- Create indexes on hash columns for faster searching
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);
CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash);
CREATE INDEX IF NOT EXISTS idx_patients_email_hash ON patients(email_hash);
CREATE INDEX IF NOT EXISTS idx_patients_phone_hash ON patients(phone_hash);
CREATE INDEX IF NOT EXISTS idx_providers_email_hash ON providers(email_hash);
CREATE INDEX IF NOT EXISTS idx_providers_phone_hash ON providers(phone_hash);

-- Verify the migration
SELECT 
    'users' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
    AND column_name IN ('email_hash', 'phone', 'phone_hash')
UNION ALL
SELECT 
    'patients' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'patients' 
    AND column_name IN ('email', 'email_hash', 'phone', 'phone_hash', 'address')
UNION ALL
SELECT 
    'providers' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'providers' 
    AND column_name IN ('email', 'email_hash', 'phone', 'phone_hash')
ORDER BY table_name, column_name;