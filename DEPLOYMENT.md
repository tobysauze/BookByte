# Deployment Guide - Making BookByte Accessible Online

This guide will help you deploy your BookByte app so it's accessible from anywhere on any device.

## Option 1: Deploy to Vercel (Recommended - Easiest)

Vercel is the best option for Next.js apps - it's free, fast, and requires minimal setup.

### Prerequisites

1. A GitHub account (free)
2. A Vercel account (free) - sign up at [vercel.com](https://vercel.com)
3. Your code pushed to GitHub (or GitLab/Bitbucket)

### Step 1: Push Your Code to GitHub

1. **Create a new repository on GitHub:**
   - Go to [github.com](https://github.com) → Click "+" → "New repository"
   - Name it `bookbyte` (or your preferred name)
   - Make it **Public** or **Private** (your choice)
   - Don't initialize with README (you already have one)

2. **Push your code:**
   ```bash
   cd /Users/tobysauze/Documents/code/BookByte
   git init  # if not already initialized
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/bookbyte.git
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` with your GitHub username.

### Step 2: Deploy to Vercel

1. **Go to Vercel:**
   - Visit [vercel.com](https://vercel.com)
   - Click "Sign Up" (or "Log In" if you have an account)
   - Sign in with GitHub

2. **Import your project:**
   - Click "Add New..." → "Project"
   - Import your GitHub repository (`bookbyte`)
   - Click "Import"

3. **Configure your project:**
   - **Framework Preset:** Next.js (should auto-detect)
   - **Root Directory:** `./` (leave as default)
   - **Build Command:** `npm run build` (should be auto-filled)
   - **Output Directory:** `.next` (should be auto-filled)
   - **Install Command:** `npm install` (should be auto-filled)

4. **Add Environment Variables:**
   Click "Environment Variables" and add all your variables from `.env.local`:
   
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   OPENROUTER_API_KEY=your-openrouter-key
   OPENROUTER_MODEL=openai/gpt-4o
   ELEVENLABS_API_KEY=your-elevenlabs-key
   ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
   ELEVENLABS_MODEL_ID=eleven_multilingual_v2
   ```
   
   **Important:** 
   - Add each variable separately
   - Make sure `NEXT_PUBLIC_*` variables are added to **Production**, **Preview**, and **Development**
   - Other variables should be added to all environments too

5. **Deploy:**
   - Click "Deploy"
   - Wait 2-3 minutes for the build to complete
   - Your app will be live at `https://your-project-name.vercel.app`

### Step 3: Configure Custom Domain (Optional)

1. In Vercel dashboard → Your Project → Settings → Domains
2. Add your domain (e.g., `bookbyte.com`)
3. Follow the DNS configuration instructions
4. Vercel will automatically provision SSL certificates

### Step 4: Update Supabase Auth Settings

1. Go to your Supabase dashboard → **Authentication** → **URL Configuration**
2. Add your Vercel URL to **Site URL**: `https://your-project-name.vercel.app`
3. Add to **Redirect URLs**: 
   - `https://your-project-name.vercel.app/auth/callback`
   - `https://your-project-name.vercel.app/**` (if using wildcard)

### Step 5: Test Your Deployment

1. Visit your Vercel URL
2. Try logging in
3. Upload a book and create a summary
4. Test on mobile devices - it should work perfectly!

---

## Option 2: Deploy to Netlify

Netlify is another great option with similar features to Vercel.

### Steps:

1. **Push to GitHub** (same as Step 1 above)

2. **Sign up for Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Sign up with GitHub

3. **Deploy:**
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub and select your repository
   - Configure:
     - **Build command:** `npm run build`
     - **Publish directory:** `.next`
   - Add environment variables (same as Vercel)
   - Click "Deploy site"

4. **Update Supabase URLs** with your Netlify URL

---

## Option 3: Deploy to Railway

Railway is good if you need more control or have specific requirements.

### Steps:

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Next.js
6. Add environment variables in the Variables tab
7. Deploy!

---

## Option 4: Self-Hosted (Advanced)

If you want to host on your own server:

### Using Docker:

1. Create a `Dockerfile`:
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. Build and run:
   ```bash
   docker build -t bookbyte .
   docker run -p 3000:3000 --env-file .env.local bookbyte
   ```

### Using PM2:

1. Install PM2: `npm install -g pm2`
2. Build: `npm run build`
3. Start: `pm2 start npm --name "bookbyte" -- start`
4. Save: `pm2 save`
5. Setup: `pm2 startup`

---

## Post-Deployment Checklist

- [ ] Environment variables are set correctly
- [ ] Supabase auth URLs are updated
- [ ] Test login/signup flow
- [ ] Test file upload
- [ ] Test summary generation
- [ ] Test on mobile device
- [ ] Check browser console for errors
- [ ] Verify storage buckets are public
- [ ] Test audio generation (if using ElevenLabs)

---

## Troubleshooting

### Build Fails

- Check build logs in Vercel/Netlify dashboard
- Ensure all environment variables are set
- Verify `package.json` has correct build script

### Authentication Not Working

- Verify Supabase redirect URLs include your deployment URL
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Clear browser cookies and try again

### File Upload Fails

- Check Supabase storage bucket policies
- Verify file size limits (Vercel has 4.5MB limit for serverless functions)
- Check Supabase storage quotas

### Images Not Loading

- Verify Supabase storage bucket is public
- Check `next.config.ts` has correct image domains
- Ensure image URLs are correct

---

## Continuous Deployment

Once deployed, every push to your `main` branch will automatically deploy:

1. Push changes to GitHub
2. Vercel/Netlify detects the push
3. Builds and deploys automatically
4. Your site updates within minutes

---

## Free Tier Limits

### Vercel:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Serverless functions (10s timeout on free tier)
- ⚠️ File uploads limited to 4.5MB (consider using Supabase Storage directly)

### Netlify:
- ✅ 100GB bandwidth/month
- ✅ 300 build minutes/month
- ✅ Serverless functions included

---

## Need Help?

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Next.js Deployment:** [nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)
- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)

---

**Recommended:** Start with Vercel - it's the easiest and most reliable option for Next.js apps!
