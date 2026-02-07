# Google Drive Cover Art Backup Setup

This feature automatically saves all generated book covers to a Google Drive folder and archives old covers when regenerating.

## Features

1. **Automatic Google Drive Backup**: Every generated cover is automatically uploaded to your specified Google Drive folder
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

Or use the migration file:
```bash
# The migration file is at: db/migration-add-archived-covers.sql
```

### 2. Create Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"
4. Create a Service Account:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Give it a name (e.g., "bookbyte-drive-uploader")
   - Click "Create and Continue"
   - Skip role assignment (click "Continue")
   - Click "Done"
5. Create a Key:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose "JSON" format
   - Download the JSON file

### 3. Share Google Drive Folder with Service Account

1. Open your Google Drive folder: https://drive.google.com/drive/folders/1OSbTASxMzJsayHr0dlSzx9dqdkp-fMR5
2. Click "Share" button
3. Add the service account email (found in the JSON file as `client_email`)
4. Give it "Editor" permissions
5. Click "Send"

### 4. Configure Environment Variables

Add these to your `.env.local` (or Netlify environment variables):

```bash
# Google Drive folder ID (from the folder URL)
GOOGLE_DRIVE_COVERS_FOLDER_ID=1OSbTASxMzJsayHr0dlSzx9dqdkp-fMR5

# Service account JSON key (paste the entire JSON content as a single-line string)
GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY={"client_email":"your-service-account@project.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","project_id":"your-project-id"}
```

**Important**: The `GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY` must be a single-line JSON string. If you have a multi-line JSON file, convert it to a single line (replace newlines with `\n`).

### 5. Verify Setup

After deploying:
1. Generate or regenerate a book cover
2. Check your Google Drive folder - the new cover should appear there
3. Check the book's `archived_covers` column in Supabase - old covers should be stored there

## How It Works

### Current Cover Storage
- **Supabase Storage**: Covers are stored in the `book-files` bucket at `${userId}/generated-cover-${bookId}.png`
- **Google Drive**: A copy is uploaded to your specified folder with filename: `{Title} by {Author}.png`

### Cover Archiving
When you regenerate a cover:
1. The old cover URL is added to the `archived_covers` array in the database
2. The old cover file remains in Supabase Storage (not deleted)
3. The new cover replaces the old one in `cover_url`
4. The new cover is uploaded to Google Drive

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
- Check that `GOOGLE_DRIVE_COVERS_FOLDER_ID` is set correctly
- Verify `GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY` is valid JSON (single-line)
- Ensure the service account email has access to the folder
- Check server logs for error messages

### Service Account Authentication Fails
- Verify the JSON key is correctly formatted
- Ensure the Google Drive API is enabled in your Google Cloud project
- Check that the service account has the correct permissions

### Old Covers Not Archiving
- Run the database migration to add the `archived_covers` column
- Check that the cover being replaced is a generated cover (not manually uploaded)
