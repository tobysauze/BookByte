-- Enable pgcrypto if not already enabled (required for hashing)
create extension if not exists pgcrypto;

-- Update the password for the specific user
-- auth.users stores the password explicitly hashed with bcrypt
UPDATE auth.users
SET encrypted_password = crypt('Amazon123', gen_salt('bf'))
WHERE email = 'tobysauze@hotmail.com';

-- Verify the update (optional, usually auth.users is protected so you might need to check via dashboard)
-- SELECT email, encrypted_password FROM auth.users WHERE email = 'tobysauze@hotmail.com';
