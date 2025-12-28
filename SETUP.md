# BookByte Setup Guide

This guide will help you set up your BookByte application with a new Supabase project.

## Step 1: Create a New Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - **Name**: BookByte (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the closest region to you
4. Click "Create new project" and wait for it to be ready (2-3 minutes)

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys" → "anon public")
   - **service_role** key (under "Project API keys" → "service_role" - keep this secret!)

## Step 3: Configure Environment Variables

1. Copy `.env.local` if it doesn't exist, or update it with your new Supabase credentials:
   ```bash
   cp env.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   
   # Add your other API keys (OpenRouter, ElevenLabs, etc.)
   OPENROUTER_API_KEY=your-openrouter-api-key
   OPENROUTER_MODEL=openai/gpt-4o
   ELEVENLABS_API_KEY=your-elevenlabs-api-key
   ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
   ELEVENLABS_MODEL_ID=eleven_multilingual_v2
   ```

## Step 4: Set Up the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Open the file `db/setup-complete.sql` from this project
4. Copy and paste the entire contents into the SQL Editor
5. Click "Run" (or press Cmd/Ctrl + Enter)
6. Wait for all migrations to complete successfully

## Step 5: Set Up Storage Buckets

1. In your Supabase dashboard, go to **Storage**
2. Create two buckets:

   **Bucket 1: `book-files`**
   - Click "New bucket"
   - Name: `book-files`
   - Public bucket: ✅ **Checked** (make it public)
   - Click "Create bucket"

   **Bucket 2: `audio`**
   - Click "New bucket"
   - Name: `audio`
   - Public bucket: ✅ **Checked** (make it public)
   - Click "Create bucket"

## Step 6: Set Up Storage Policies

1. In your Supabase dashboard, go to **Storage** → **Policies**
2. For each bucket (`book-files` and `audio`), you need to add policies
3. Go to **SQL Editor** again
4. Open the file `db/storage-policies.sql` from this project
5. Copy and paste the contents into the SQL Editor
6. Click "Run"

Alternatively, you can set up policies manually in the Storage → Policies section for each bucket.

## Step 7: Install Dependencies and Run the App

1. Install npm dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Step 8: Test Authentication

1. Navigate to the login page
2. Sign up for a new account
3. Verify that you can log in successfully

## Troubleshooting

### Database Connection Issues
- Verify your `.env.local` file has the correct Supabase URL and keys
- Make sure there are no extra spaces or quotes around the values
- Restart your development server after changing environment variables

### Storage Issues
- Verify both buckets (`book-files` and `audio`) are created and marked as public
- Check that storage policies are applied correctly
- Review the Storage → Policies section in Supabase dashboard

### Migration Errors
- Make sure you're running migrations in order
- Check the SQL Editor for any error messages
- Some migrations may fail if tables already exist (this is okay if using IF NOT EXISTS)

### Authentication Issues
- Verify Row Level Security (RLS) policies are enabled on all tables
- Check that the `auth.users` table exists (created automatically by Supabase)

## Next Steps

- Configure your OpenRouter API key for AI features
- Set up ElevenLabs API key if you want audio summaries
- Start uploading books and creating summaries!
