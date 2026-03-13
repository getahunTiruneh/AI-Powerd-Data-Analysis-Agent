/*
  # Promote gechtiru@gmail.com to Admin

  This migration creates a test admin user or promotes an existing one.
  NOTE: This user must be created in Supabase Auth first through the application UI.
  
  To use this:
  1. Register gechtiru@gmail.com through the login/register screen
  2. Then run this migration to promote the user to admin
*/

-- Get the user ID from auth.users and update their profile to admin
DO $$
DECLARE
  user_id UUID;
BEGIN
  -- Get the user ID from Supabase auth.users table
  SELECT id INTO user_id FROM auth.users WHERE email = 'gechtiru@gmail.com' LIMIT 1;
  
  IF user_id IS NOT NULL THEN
    -- Update existing profile to admin status
    UPDATE user_profiles
    SET role = 'admin', status = 'active'
    WHERE id = user_id;
    
    RAISE NOTICE 'User % promoted to admin', user_id;
  ELSE
    RAISE NOTICE 'User gechtiru@gmail.com not found in auth.users. Please register first through the application UI.';
  END IF;
END $$;