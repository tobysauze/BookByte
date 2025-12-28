# How to Make a User an Editor

There are two ways to change a user's role to editor:

## Option 1: Using SQL in Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New query**
4. Copy and paste this SQL (replace `YOUR_EMAIL@example.com` with your actual email):

```sql
-- Make a user an editor by email
UPDATE public.user_profiles
SET is_editor = true,
    updated_at = now()
WHERE id IN (
  SELECT id 
  FROM auth.users 
  WHERE email = 'YOUR_EMAIL@example.com'
);

-- Verify the change
SELECT 
  u.email,
  up.is_editor,
  up.created_at,
  up.updated_at
FROM public.user_profiles up
JOIN auth.users u ON u.id = up.id
WHERE u.email = 'YOUR_EMAIL@example.com';
```

5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see `is_editor = true` in the results
7. **Refresh your browser** - you may need to log out and log back in for the change to take effect

## Option 2: Find User ID First, Then Update

If you don't know your email or want to use the user ID:

1. First, find your user ID:

```sql
-- Find user by email
SELECT 
  id,
  email,
  created_at
FROM auth.users
WHERE email = 'YOUR_EMAIL@example.com';
```

2. Then update using the ID:

```sql
-- Make user an editor by ID
UPDATE public.user_profiles
SET is_editor = true,
    updated_at = now()
WHERE id = 'USER_ID_FROM_ABOVE';
```

## Option 3: See All Users and Their Roles

To see all users and their editor status:

```sql
SELECT 
  u.id,
  u.email,
  u.created_at as user_created_at,
  COALESCE(up.is_editor, false) as is_editor,
  up.created_at as profile_created_at
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
ORDER BY u.created_at DESC;
```

## What Changes When You Become an Editor?

- **Library Page**: Shows all books you created (not just saved ones)
- **Book Management**: You can edit and delete any book
- **Create Books**: Full access to create book summaries
- **Summary Ratings**: Can rate summaries created by others

## Troubleshooting

- **Change not taking effect?** Try logging out and logging back in
- **User profile doesn't exist?** The profile should be created automatically when you sign up. If it doesn't exist, run:

```sql
-- Create profile if missing
INSERT INTO public.user_profiles (id, is_editor)
SELECT id, false
FROM auth.users
WHERE email = 'YOUR_EMAIL@example.com'
ON CONFLICT (id) DO NOTHING;

-- Then make them an editor
UPDATE public.user_profiles
SET is_editor = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com'
);
```
