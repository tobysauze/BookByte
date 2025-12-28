<p align="center">
  <img src="https://raw.githubusercontent.com/tobysauze/bookbyte/main/public/file.svg" alt="BookByte" width="120" />
</p>

# BookByte

BookByte is an AI-powered book summary platform. Upload non-fiction PDFs or text files and receive a five-part summary, actionable insights, and audio highlights—stored securely in Supabase for easy access.

## Features

- Upload PDFs, TXT, or Markdown up to 20MB (client enforced)
- Automated text extraction and chunking
- OpenAI-powered summaries with five structured sections
- Optional Google Gemini comparison summaries (side-by-side)
- ElevenLabs audio generation per summary section
- Supabase authentication (email/password)
- Personal library with progress tracking and detail view tabs
- Discover page with curated sample summaries
- Responsive Tailwind + shadcn-inspired UI

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4 + custom shadcn-inspired components
- **Database & Auth:** Supabase (Postgres + Auth + Storage)
- **AI:** OpenAI Responses API, ElevenLabs Text-to-Speech
- **Deployment:** Vercel-ready (Node.js runtime for AI routes)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `env.example` to `.env.local` and fill in your credentials:

```bash
cp env.example .env.local
```

Required variables:

```
OPENAI_API_KEY=
OPENAI_SUMMARY_MODEL=gpt-4.1-mini

GEMINI_API_KEY=
GEMINI_SUMMARY_MODEL=gemini-1.5-pro-latest

ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### 3. Provision Supabase

1. Create a new Supabase project.
2. Run `db/schema.sql` in the SQL editor to create the `books` table, RLS policies, and helper function.
3. In Supabase **Storage**, create two public buckets:
   - `book-files` – stores original uploads.
   - `audio` – stores generated MP3 files.
4. Add storage policies (Storage → Policies) so authenticated users can read/write their own objects.

### 4. Start the development server

```bash
npm run dev
```

Visit `http://localhost:3000` to access the app.

## Project Structure

```
app/
  page.tsx               // Upload + summary flow
  discover/page.tsx      // Featured summaries
  library/page.tsx       // Authenticated library view
  books/[id]/page.tsx    // Summary detail with tabs & audio
  login/page.tsx         // Email/password auth
  profile/page.tsx       // Basic account overview
  api/
    summarize/route.ts   // File → summary pipeline
    library/route.ts     // Manual save endpoint
    tts/route.ts         // ElevenLabs integration
    auth/[...supabase]   // Supabase auth callback handler

components/
  home-client.tsx        // Client controller for upload flow
  summary-tabs.tsx       // Tabbed summary renderer
  audio-player.tsx       // Custom audio player component
  ui/                    // shadcn-inspired primitives

lib/
  supabase.ts            // Browser/server Supabase clients
  supabase-admin.ts      // Service-role client helper
  openai.ts              // OpenAI summary helper
  gemini.ts              // Google Gemini summary helper
  elevenlabs.ts          // Text-to-speech helper
  pdf.ts                 // PDF parsing helpers
  chunk-merge.ts         // Text chunking utilities
  schemas.ts             // Zod schemas & types
```

## API Contracts

### `POST /api/summarize`

- Accepts: `multipart/form-data` with `file` (required), optional `title`, `author`, `filename`.
- Auth required (Supabase session cookie).
- Extracts text, chunks, summarises via OpenAI (primary) and optionally Google Gemini for comparison.
- Uploads original file to Supabase Storage, saves OpenAI summary JSON in `books` table.
- Returns `{ bookId, summary, comparisonSummary, metadata }` — `comparisonSummary` is `null` when Gemini is disabled or the request fails.

### `POST /api/library`

- Accepts: JSON `{ summary, metadata }` for manual saves.
- Useful if you wish to save a locally-edited summary payload.

### `POST /api/tts`

- Accepts: JSON `{ bookId, section }`.
- Generates audio with ElevenLabs, uploads to `audio` bucket, updates `books.audio_urls` map.
- Returns `{ audioUrl }`.

## Testing Notes

- Run `npm run lint` before committing changes.
- The app uses Tailwind 4 preview; arbitrary value classes (e.g. `bg-[rgb(var(--background))]`) are intentional.
- API routes run with the Node.js runtime due to dependence on `Buffer`, `pdf-parse`, and ElevenLabs streaming responses.

## Deployment

Deploy to Vercel with the Node.js runtime. Add environment variables in the Vercel dashboard and ensure Supabase buckets are public with the policies outlined above.

---

Built with ❤️ by the BookByte team.
