const FOLDER_ID = "1X4KKcRO8UkImXJrxkoQEiZttc78fpejN";
const BOOKBYTE_IMPORT_URL = "https://bookbytee.netlify.app/api/import/google-drive";
const BOOKBYTE_COVER_BG_URL = "https://bookbytee.netlify.app/.netlify/functions/generate-cover-background";
const IMPORT_SECRET = "tobymaryjeanlaciotat2026";

function syncFolder() {
  const props = PropertiesService.getScriptProperties();
  const processed = JSON.parse(props.getProperty("processed_ids") || "[]");
  const processedSet = new Set(processed);

  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files = folder.getFiles();

  let changed = false;

  while (files.hasNext()) {
    const file = files.next();
    const id = file.getId();
    if (processedSet.has(id)) continue;

    const name = file.getName();
    const baseName = name.replace(/\.[^.]+$/, ""); // strip extension
    const mime = file.getMimeType();

    // Extract title/author from filename like: "Miracle Morning by Hal Elrod"
    let parsedTitle = baseName.trim();
    let parsedAuthor = null;
    const m = baseName.match(/^(.*?)\s+by\s+(.+)$/i);
    if (m) {
      parsedTitle = (m[1] || "").trim() || parsedTitle;
      parsedAuthor = (m[2] || "").trim() || null;
    }

    // Extract text safely
    let text = "";
    if (mime === MimeType.GOOGLE_DOCS) {
      text = (DocumentApp.openById(id).getBody().getText() || "").trim();
    } else if (mime === MimeType.PLAIN_TEXT) {
      text = (file.getBlob().getDataAsString("UTF-8") || "").trim();
    } else {
      // Try anyway for other text-ish files, but if it ends up empty we'll skip.
      text = (file.getBlob().getDataAsString("UTF-8") || "").trim();
    }

    // Skip empty/unsupported files (don't mark as processed)
    if (!text) {
      console.log("Skipping empty/unsupported file:", name, mime, id);
      continue;
    }

    const payload = {
      title: parsedTitle,
      author: parsedAuthor, // important for auto-cover generation
      text,
      isPublic: false,
      source: "google_drive",
    };

    // 1) Import into BookByte (fast)
    const res = UrlFetchApp.fetch(BOOKBYTE_IMPORT_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      headers: { "x-import-secret": IMPORT_SECRET },
      muteHttpExceptions: true,
    });

    const code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error("BookByte import failed: " + code + " " + res.getContentText());
    }

    const importJson = JSON.parse(res.getContentText());
    const bookId = importJson.bookId;

    // 2) Trigger background cover generation (async; do not fail the import if it errors)
    try {
      const coverRes = UrlFetchApp.fetch(BOOKBYTE_COVER_BG_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ bookId }),
        headers: { "x-import-secret": IMPORT_SECRET },
        muteHttpExceptions: true,
      });

      const coverCode = coverRes.getResponseCode();
      if (coverCode < 200 || coverCode >= 300) {
        console.log("Cover generation trigger failed:", coverCode, coverRes.getContentText());
      }
    } catch (e) {
      console.log("Cover generation trigger threw:", e);
    }

    processedSet.add(id);
    changed = true;

    console.log("Imported:", name, "-> bookId:", bookId);
  }

  if (changed) {
    props.setProperty("processed_ids", JSON.stringify(Array.from(processedSet)));
  }
}

// Optional helper: run once if you want to re-import everything
function resetProcessed() {
  PropertiesService.getScriptProperties().deleteProperty("processed_ids");
}

/**
 * Set up daily automation trigger
 * Run this function ONCE to create a daily trigger that runs syncFolder() automatically
 */
function installTextImportTrigger() {
  // Delete any existing triggers for syncFolder
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncFolder') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new daily trigger (runs every day at specified hour)
  // Change the number below to your preferred hour (0-23, where 0 = midnight, 14 = 2 PM, etc.)
  const triggerHour = 3;  // ⬅️ CHANGE THIS NUMBER (0-23) to set your preferred time
  
  ScriptApp.newTrigger('syncFolder')
    .timeBased()
    .everyDays(1)
    .atHour(triggerHour)
    .create();
  
  Logger.log('Daily trigger for syncFolder() created successfully!');
  Logger.log('The script will run automatically every day at ' + triggerHour + ':00.');
}

/**
 * Remove the daily trigger
 */
function removeTextImportTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncFolder') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Trigger removed');
    }
  });
}

/**
 * Check current time and timezone settings
 * Run this to see what time Google Apps Script thinks it is
 */
function checkCurrentTime() {
  const now = new Date();
  const timezone = Session.getScriptTimeZone();
  
  Logger.log('=== Current Time Information ===');
  Logger.log('Current Date/Time: ' + now.toString());
  Logger.log('ISO String: ' + now.toISOString());
  Logger.log('Script Timezone: ' + timezone);
  Logger.log('Local Time String: ' + Utilities.formatDate(now, timezone, 'yyyy-MM-dd HH:mm:ss z'));
  Logger.log('Hour (0-23): ' + now.getHours());
  Logger.log('');
  Logger.log('Your triggers will run based on this timezone.');
  Logger.log('To change timezone: Project Settings → Time zone');
}

/**
 * Test function - run this manually to test syncFolder() right now
 * This simulates what will happen at 3 AM
 */
function testSyncFolder() {
  Logger.log('=== Starting test run of syncFolder() ===');
  Logger.log('Time: ' + new Date().toISOString());
  
  try {
    // Test folder access
    Logger.log('Testing folder access...');
    const folder = DriveApp.getFolderById(FOLDER_ID);
    Logger.log('✓ Folder accessed successfully: ' + folder.getName());
    
    // Count files
    const files = folder.getFiles();
    let fileCount = 0;
    while (files.hasNext()) {
      files.next();
      fileCount++;
    }
    Logger.log('✓ Found ' + fileCount + ' file(s) in folder');
    
    // Check processed files
    const props = PropertiesService.getScriptProperties();
    const processed = JSON.parse(props.getProperty("processed_ids") || "[]");
    Logger.log('✓ Currently tracking ' + processed.length + ' processed file(s)');
    
    // Run the actual sync
    Logger.log('Running syncFolder()...');
    syncFolder();
    
    Logger.log('=== Test completed successfully! ===');
    Logger.log('Check the logs above for any imported files.');
    Logger.log('If files were imported, check your BookByte library to verify.');
    
  } catch (error) {
    Logger.log('=== TEST FAILED ===');
    Logger.log('Error: ' + error.toString());
    Logger.log('Stack: ' + (error.stack || 'No stack trace'));
    throw error;
  }
}

/**
 * Test the trigger setup (without waiting until 3 AM)
 * Creates a test trigger that runs in 1 minute
 */
function testTriggerSetup() {
  Logger.log('=== Testing trigger setup ===');
  
  // Delete any existing test triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncFolder') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Removed existing trigger');
    }
  });
  
  // Create a test trigger that runs in 1 minute
  const now = new Date();
  const oneMinuteLater = new Date(now.getTime() + 60 * 1000);
  
  ScriptApp.newTrigger('syncFolder')
    .timeBased()
    .at(oneMinuteLater)
    .create();
  
  Logger.log('✓ Test trigger created!');
  Logger.log('The trigger will fire in approximately 1 minute.');
  Logger.log('Check the "Executions" tab in a few minutes to see if it ran.');
  Logger.log('');
  Logger.log('After testing, run removeTextImportTrigger() to clean up,');
  Logger.log('then run installTextImportTrigger() to set up the real daily trigger.');
}
