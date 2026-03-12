-- Script to create a default admin user for CBE AI Platform
--
-- INSTRUCTIONS:
-- 1. First, register a user through the application UI
-- 2. Run this script in Supabase SQL Editor to make that user an admin
-- 3. Replace 'admin@cbe.com.et' with the actual email address

-- Update user to admin and activate account
UPDATE user_profiles
SET
  role = 'admin',
  status = 'active'
WHERE email = 'admin@cbe.com.et';

-- Verify the change
SELECT
  id,
  email,
  full_name,
  role,
  status,
  department
FROM user_profiles
WHERE email = 'admin@cbe.com.et';

-- SAMPLE DATA: Create demo data marts for testing (optional)

INSERT INTO data_marts (name, description, database_type, is_active)
VALUES
  (
    'Retail Banking Data Mart',
    'Comprehensive retail banking data including loans, deposits, and customer accounts',
    'postgresql',
    true
  ),
  (
    'Digital Banking Data Mart',
    'Digital banking metrics, mobile app usage, and online transaction data',
    'postgresql',
    true
  ),
  (
    'Customer Analytics Data Mart',
    'Customer demographic data, segmentation, and behavior analytics',
    'postgresql',
    true
  ),
  (
    'Transaction Data Mart',
    'Real-time and historical transaction data across all channels',
    'postgresql',
    true
  )
ON CONFLICT DO NOTHING;

-- Verify data marts were created
SELECT id, name, is_active FROM data_marts;
