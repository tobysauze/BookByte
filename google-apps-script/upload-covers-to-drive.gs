/**
 * Google Apps Script to upload book covers to Google Drive
 * 
 * This script monitors Supabase for new/updated covers and uploads them to Google Drive.
 * Run this periodically (e.g., every 15 minutes) or trigger it from the cover generation API.
 * 
 * Required Script Properties:
 *  - BOOKBYTE_BASE_URL
 *  - BOOKBYTE_IMPORT_SECRET
 *  - COVERS_FOLDER_ID (Google Drive folder for covers)
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY (for querying books)
 */

const COVERS_FOLDER_ID = "1OSbTASxMzJsayHr0dlSzx9dqdkp-fMR5";

function uploadCoversToDrive() {
  try {
    const cfg = getConfig_();
    const processed = getProcessedCovers_();
    
    // Query Supabase for books with covers that haven't been uploaded
    // This is a simplified version - you might want to add a column to track upload status
    const books = queryBooksWithCovers_(cfg);
    
    let uploaded = 0;
    let errors = 0;
    
    for (const book of books) {
      const coverKey = `${book.id}_${book.cover_url}`;
      if (processed.has(coverKey)) {
        continue; // Already processed
      }
      
      try {
        const driveFileName = `${book.title}${book.author ? ` by ${book.author}` : ""}.png`;
        uploadCoverToDrive_(book.cover_url, driveFileName, cfg);
        
        processed.add(coverKey);
        uploaded++;
        
        Logger.log(`Uploaded cover for: ${book.title}`);
      } catch (error) {
        Logger.log(`Error uploading cover for ${book.title}: ${error}`);
        errors++;
      }
    }
    
    setProcessedCovers_(processed);
    Logger.log(`Upload complete. Uploaded: ${uploaded}, Errors: ${errors}`);
    
  } catch (error) {
    Logger.log(`uploadCoversToDrive failed: ${error}`);
    throw error;
  }
}

function uploadCoverToDrive_(imageUrl, fileName, cfg) {
  const driveAccessToken = ScriptApp.getOAuthToken();
  
  const payload = {
    imageUrl: imageUrl,
    fileName: fileName,
    folderId: COVERS_FOLDER_ID,
    driveAccessToken: driveAccessToken,
  };
  
  const res = urlFetchJson_({
    url: cfg.BOOKBYTE_BASE_URL.replace(/\/+$/, "") + "/api/upload-cover-to-drive",
    method: "post",
    headers: {
      "content-type": "application/json",
      "x-import-secret": cfg.BOOKBYTE_IMPORT_SECRET,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  
  if (!(res.status >= 200 && res.status < 300)) {
    throw new Error(`Upload failed: HTTP ${res.status} - ${res.text}`);
  }
  
  return res.json;
}

function queryBooksWithCovers_(cfg) {
  // Query Supabase for books with cover_url
  // This is a simplified version - you might want to add a proper API endpoint
  const res = urlFetchJson_({
    url: `${cfg.SUPABASE_URL}/rest/v1/books?select=id,title,author,cover_url&cover_url=not.is.null&limit=100`,
    method: "get",
    headers: {
      "apikey": cfg.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${cfg.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    muteHttpExceptions: true,
  });
  
  if (!(res.status >= 200 && res.status < 300) || !Array.isArray(res.json)) {
    Logger.log(`Failed to query books: HTTP ${res.status}`);
    return [];
  }
  
  return res.json;
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    BOOKBYTE_BASE_URL: props.getProperty("BOOKBYTE_BASE_URL") || "https://bookbytee.netlify.app",
    BOOKBYTE_IMPORT_SECRET: props.getProperty("BOOKBYTE_IMPORT_SECRET") || "",
    SUPABASE_URL: props.getProperty("SUPABASE_URL") || "",
    SUPABASE_SERVICE_ROLE_KEY: props.getProperty("SUPABASE_SERVICE_ROLE_KEY") || "",
  };
}

function getProcessedCovers_() {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty("PROCESSED_COVERS");
  if (!stored) return new Set();
  try {
    return new Set(JSON.parse(stored));
  } catch {
    return new Set();
  }
}

function setProcessedCovers_(processed) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("PROCESSED_COVERS", JSON.stringify(Array.from(processed)));
}

function urlFetchJson_(opts) {
  const resp = UrlFetchApp.fetch(opts.url, {
    method: opts.method,
    headers: opts.headers || {},
    payload: opts.payload,
    muteHttpExceptions: Boolean(opts.muteHttpExceptions),
    followRedirects: true,
  });

  const status = resp.getResponseCode();
  const text = resp.getContentText() || "";
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: status, text: text, json: json };
}

/**
 * Install trigger to run every 15 minutes
 */
function installCoverUploadTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'uploadCoversToDrive') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('uploadCoversToDrive')
    .timeBased()
    .everyMinutes(15)
    .create();
  
  Logger.log('Cover upload trigger installed (runs every 15 minutes)');
}
