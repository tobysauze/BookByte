# Quick Deployment Guide - 5 Minutes to Go Live! 🚀

## Fastest Way: Vercel (Recommended)

### Step 1: Push to GitHub (2 minutes)

```bash
# If you haven't initialized git yet
cd /Users/tobysauze/Documents/code/BookByte
git init
git add .
git commit -m "Ready to deploy"

# Create a new repo on GitHub.com, then:
git remote add origin https://github.com/YOUR_USERNAME/bookbyte.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel (3 minutes)

1. Go to **[vercel.com](https://vercel.com)** → Sign up with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import your `bookbyte` repository
4. Click **"Environment Variables"** and add these:

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   OPENROUTER_API_KEY
   OPENROUTER_MODEL
   ELEVENLABS_API_KEY
   ELEVENLABS_VOICE_ID
   ELEVENLABS_MODEL_ID
   ```

   Copy values from your `.env.local` file.

5. Click **"Deploy"**
6. Wait 2 minutes... ✨ **Your app is live!**

### Step 3: Update Supabase (1 minute)

1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add your Vercel URL: `https://your-project.vercel.app`
3. Add redirect URL: `https://your-project.vercel.app/auth/callback`

**Done!** 🎉 Your app is now accessible from anywhere!

---

## Your Live URL

After deployment, you'll get a URL like:
- `https://bookbyte-abc123.vercel.app`

Share this URL with anyone - they can access your app from any device!

---

## Need More Details?

See `DEPLOYMENT.md` for comprehensive instructions and troubleshooting.
