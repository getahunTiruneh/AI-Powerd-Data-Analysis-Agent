/*
  # Create admin profile for gechtiru@gmail.com
  
  Creates the user_profiles entry for the authenticated user.
*/

INSERT INTO user_profiles (id, email, full_name, role, status, department)
VALUES (
  '468fd4ff-015d-48a6-80de-52b06c8ebe68',
  'gechtiru@gmail.com',
  'Gechtiru Admin',
  'admin',
  'active',
  'Administration'
)
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  status = 'active';