# Quick Start Guide - Setting Up BookByte

Follow these steps to get your app running with a new Supabase project:

## 1. Create Supabase Project
- Go to [supabase.com](https://supabase.com) → New Project
- Save your project URL and API keys

## 2. Update Environment Variables
Edit `.env.local` and add:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 3. Run Database Setup
1. In Supabase dashboard → **SQL Editor**
2. Open `db/setup-complete.sql`
3. Copy & paste entire file → Click **Run**

## 4. Create Storage Buckets
In Supabase dashboard → **Storage**:
- Create bucket: `book-files` (✅ Public)
- Create bucket: `audio` (✅ Public)

## 5. Set Up Storage Policies
1. In Supabase dashboard → **SQL Editor**
2. Open `db/storage-policies.sql`
3. Copy & paste → Click **Run**

## 6. Run the App
```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

**Full details:** See `SETUP.md` for comprehensive instructions.
