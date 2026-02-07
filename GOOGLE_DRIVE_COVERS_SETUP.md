# Google Drive Cover Art Backup Setup

This feature automatically saves all generated book covers to a Google Drive folder and archives old covers when regenerating.

## Features

1. **Automatic Google Drive Backup**: Google Apps Script automatically uploads covers to your Drive folder
2. **Cover Archiving**: When you regenerate a cover, the old one is archived (not deleted) so you can access it later
3. **Archived Covers Storage**: Old covers are stored in the `archived_covers` JSONB column in the database

## Setup Instructions

### 1. Run the Database Migration

Run the migration to add the `archived_covers` column:

```sql
-- Run this in Supabase SQL Editor
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS archived_covers JSONB DEFAULT '[]'::jsonb;
```

### 2. Set Up Google Apps Script

1. Go to [Google Apps Script](https://script.google.com)
2. Create a new project or add to existing project
3. Copy the code from `google-apps-script/upload-covers-to-drive.gs`
4. Update Script Properties:
   - `BOOKBYTE_BASE_URL` - Your BookByte URL (e.g., https://bookbytee.netlify.app)
   - `BOOKBYTE_IMPORT_SECRET` - Your `GOOGLE_DRIVE_IMPORT_SECRET`
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
5. Authorize the script (it needs Drive and URL Fetch permissions)
6. Run `installCoverUploadTrigger()` once to set up automatic uploads every 15 minutes

### 3. Make Google Drive Folder Public (Optional)

If you want the folder to be publicly accessible:
1. Open your Google Drive folder: https://drive.google.com/drive/folders/1OSbTASxMzJsayHr0dlSzx9dqdkp-fMR5
2. Click "Share" → "Change to anyone with the link"
3. Set permission to "Viewer" or "Editor" as needed

### 4. Verify Setup

After setup:
1. Generate or regenerate a book cover
2. Wait up to 15 minutes (or run `uploadCoversToDrive()` manually)
3. Check your Google Drive folder - the new cover should appear there
4. Check the book's `archived_covers` column in Supabase - old covers should be stored there

## How It Works

### Current Cover Storage
- **Supabase Storage**: Covers are stored in the `book-files` bucket at `${userId}/generated-cover-${bookId}.png`
- **Google Drive**: Google Apps Script polls for new covers and uploads them automatically with filename: `{Title} by {Author}.png`

### Cover Archiving
When you regenerate a cover:
1. The old cover URL is added to the `archived_covers` array in the database
2. The old cover file remains in Supabase Storage (not deleted)
3. The new cover replaces the old one in `cover_url`
4. Google Apps Script will upload the new cover to Google Drive on next run

### Accessing Archived Covers

Archived covers are stored in the database as:
```json
[
  {
    "url": "https://...",
    "archived_at": "2026-02-07T12:00:00Z",
    "reason": "Regenerated with feedback: Author name correction"
  }
]
```

You can query them via Supabase or add a UI to display them later.

## Troubleshooting

### Covers not uploading to Google Drive
- Check that the Google Apps Script trigger is installed
- Verify Script Properties are set correctly
- Run `uploadCoversToDrive()` manually to test
- Check execution logs in Google Apps Script

### Old Covers Not Archiving
- Run the database migration to add the `archived_covers` column
- Check that the cover being replaced is a generated cover (not manually uploaded)
