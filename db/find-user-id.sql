-- Script to find a user's ID by email
-- Replace 'USER_EMAIL_HERE' with the email you're looking for

SELECT 
  id,
  email,
  created_at
FROM auth.users
WHERE email = 'USER_EMAIL_HERE';

-- To see all users and their editor status:
SELECT 
  u.id,
  u.email,
  u.created_at as user_created_at,
  COALESCE(up.is_editor, false) as is_editor,
  up.created_at as profile_created_at
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
ORDER BY u.created_at DESC;
