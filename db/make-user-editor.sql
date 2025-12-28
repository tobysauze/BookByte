-- Script to make a user an editor
-- Replace 'USER_EMAIL_HERE' with the email of the user you want to make an editor
-- Or replace 'USER_ID_HERE' with the UUID of the user

-- Option 1: Update by email (recommended - easier to use)
UPDATE public.user_profiles
SET is_editor = true,
    updated_at = now()
WHERE id IN (
  SELECT id 
  FROM auth.users 
  WHERE email = 'USER_EMAIL_HERE'
);

-- Option 2: Update by user ID (if you know the UUID)
-- UPDATE public.user_profiles
-- SET is_editor = true,
--     updated_at = now()
-- WHERE id = 'USER_ID_HERE';

-- Verify the change
SELECT 
  u.email,
  up.is_editor,
  up.created_at,
  up.updated_at
FROM public.user_profiles up
JOIN auth.users u ON u.id = up.id
WHERE u.email = 'USER_EMAIL_HERE';
