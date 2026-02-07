/**
 * BookByte PDF -> Kimi summary automation (Google Apps Script)
 *
 * 1 PDF / day behavior:
 * - submitNewPdfJobs() runs once/day and will submit at most ONE PDF
 * - It will NOT submit a new PDF if there is already a tracked job in progress
 * - pollPdfJobs() runs every 15 minutes and advances that one job
 * - pollPdfJobs() AUTO-KICKS when status is queued (multi-chunk continuation)
 *
 * Required Script Properties:
 *  - BOOKBYTE_BASE_URL            (use https://bookbytee.netlify.app for now)
 *  - BOOKBYTE_IMPORT_SECRET       (must match Netlify GOOGLE_DRIVE_IMPORT_SECRET)
 *  - SOURCE_FOLDER_ID
 *  - OUTPUT_FOLDER_ID
 *  - DONE_FOLDER_ID
 *
 * Optional Script Properties:
 *  - KIMI_MODEL (default "kimi-k2.5")
 *  - MAX_SCAN_FILES (default "200")
 */

function install() {
  deleteExistingTriggers_();

  // ⬅️ CHANGE THESE NUMBERS to set your preferred times:
  const submitHour = 2;        // Hour to submit new PDF (0-23, where 0 = midnight, 14 = 2 PM)
  const pollIntervalMinutes = 15;  // How often to check job status (in minutes)

  ScriptApp.newTrigger("submitNewPdfJobs")
    .timeBased()
    .everyDays(1)
    .atHour(submitHour)
    .create();

  ScriptApp.newTrigger("pollPdfJobs")
    .timeBased()
    .everyMinutes(pollIntervalMinutes)
    .create();

  Logger.log("Installed triggers for 1 PDF/day + polling.");
  Logger.log("PDF submission: daily at " + submitHour + ":00");
  Logger.log("Job polling: every " + pollIntervalMinutes + " minutes");
}

function submitNewPdfJobs() {
  try {
    const cfg = getConfig_();
    const jobsState = getJobsState_();

    // Enforce "one at a time": if a job is already tracked, do nothing.
    const trackedCount = Object.keys(jobsState).length;
    if (trackedCount > 0) {
      Logger.log(`submitNewPdfJobs: ${trackedCount} job(s) already tracked. Skipping new submission.`);
      return;
    }

    const maxScan = Number(getProp_("MAX_SCAN_FILES") || "200");

    const source = withRetries_(
      () => DriveApp.getFolderById(cfg.SOURCE_FOLDER_ID),
      "DriveApp.getFolderById(SOURCE_FOLDER_ID)"
    );

    const nextPdf = withRetries_(
      () => pickNextUntrackedPdf_(source, jobsState, maxScan),
      "pickNextUntrackedPdf_"
    );

    if (!nextPdf) {
      Logger.log("submitNewPdfJobs: No untracked PDFs found in source folder.");
      return;
    }

    const fileId = nextPdf.getId();
    const fileName = nextPdf.getName() || "Untitled.pdf";

    const driveAccessToken = withRetries_(() => ScriptApp.getOAuthToken(), "ScriptApp.getOAuthToken");

    const payload = {
      driveFileId: fileId,
      driveAccessToken: driveAccessToken,
      fileName: fileName,
      model: cfg.KIMI_MODEL,
    };

    const res = withRetries_(
      () =>
        urlFetchJson_({
          url: cfg.BOOKBYTE_BASE_URL.replace(/\/+$/, "") + "/api/pdf-summary-jobs",
          method: "post",
          headers: {
            "content-type": "application/json",
            "x-import-secret": cfg.BOOKBYTE_IMPORT_SECRET,
          },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        }),
      "POST /api/pdf-summary-jobs"
    );

    if (res.status >= 200 && res.status < 300 && res.json && res.json.jobId) {
      const jobId = String(res.json.jobId);
      jobsState[fileId] = {
        jobId: jobId,
        fileName: fileName,
        createdAtIso: new Date().toISOString(),
      };
      setJobsState_(jobsState);
      Logger.log(`Created job for ${fileName}: ${jobId}`);
      return;
    }

    Logger.log(`Failed to create job for ${fileName}. HTTP ${res.status}. Body: ${res.text}`);
  } catch (e) {
    Logger.log(`submitNewPdfJobs crashed: ${stringifyError_(e)}`);
    throw e;
  }
}

function pollPdfJobs() {
  try {
    const cfg = getConfig_();
    const jobsState = getJobsState_();
    const fileIds = Object.keys(jobsState);

    if (fileIds.length === 0) {
      Logger.log("pollPdfJobs: No tracked jobs.");
      return;
    }

    // One per run (gentle)
    const fileId = fileIds[0];
    const entry = jobsState[fileId];
    if (!entry || !entry.jobId) {
      Logger.log("pollPdfJobs: Invalid tracked entry; removing.");
      delete jobsState[fileId];
      setJobsState_(jobsState);
      return;
    }

    const res = withRetries_(
      () =>
        urlFetchJson_({
          url:
            cfg.BOOKBYTE_BASE_URL.replace(/\/+$/, "") +
            "/api/pdf-summary-jobs?id=" +
            encodeURIComponent(entry.jobId),
          method: "get",
          headers: {
            "x-import-secret": cfg.BOOKBYTE_IMPORT_SECRET,
          },
          muteHttpExceptions: true,
        }),
      "GET /api/pdf-summary-jobs"
    );

    if (!(res.status >= 200 && res.status < 300) || !res.json) {
      Logger.log(`Poll failed for job ${entry.jobId}. HTTP ${res.status}. Body: ${res.text}`);
      return;
    }

    const status = String(res.json.status || "");
    Logger.log(`Job ${entry.jobId} status: ${status}`);

    // DEBUG: show timestamps + error field from API
    Logger.log(
      `Job updatedAt=${res.json.updatedAt} createdAt=${res.json.createdAt} error=${res.json.error || ""}`
    );

    // AUTO-KICK: when worker returns job to queued for next chunk
    if (status === "queued") {
      Logger.log("Job is queued — auto-kicking worker to continue next chunk...");
      kickQueuedJob();
      return;
    }

    if (status === "done") {
      const resultText = res.json.resultText;
      if (typeof resultText !== "string" || !resultText.trim()) {
        Logger.log(`Job ${entry.jobId} done but empty resultText. Leaving tracked.`);
        return;
      }

      const outputFolder = withRetries_(
        () => DriveApp.getFolderById(cfg.OUTPUT_FOLDER_ID),
        "DriveApp.getFolderById(OUTPUT_FOLDER_ID)"
      );
      const doneFolder = withRetries_(
        () => DriveApp.getFolderById(cfg.DONE_FOLDER_ID),
        "DriveApp.getFolderById(DONE_FOLDER_ID)"
      );


      const outName = cleanSummaryOutputFileName_(entry.fileName || ("job-" + entry.jobId));
      const finalName = fileExists_(outputFolder, outName)
        ? outName.replace(/\.txt$/i, ` (${entry.jobId}).txt`)
        : outName;


      withRetries_(
        () => outputFolder.createFile(finalName, resultText, MimeType.PLAIN_TEXT),
        "outputFolder.createFile"
      );
      Logger.log(`Wrote summary: ${finalName}`);

      // Move the PDF
      try {
        const pdfFile = withRetries_(() => DriveApp.getFileById(fileId), "DriveApp.getFileById");
        withRetries_(() => pdfFile.moveTo(doneFolder), "pdfFile.moveTo(doneFolder)");
        Logger.log(`Moved PDF to done: ${entry.fileName}`);
      } catch (moveErr) {
        Logger.log(`Could not move PDF ${fileId}. Error: ${stringifyError_(moveErr)}`);
      }

      delete jobsState[fileId];
      setJobsState_(jobsState);
      return;
    }

    if (status === "error") {
      Logger.log(`Job ${entry.jobId} errored: ${res.json.error || "Unknown error"}`);
      // Keep tracked so you can inspect/retry later.
      return;
    }

    // running -> keep waiting
  } catch (e) {
    Logger.log(`pollPdfJobs crashed: ${stringifyError_(e)}`);
    throw e;
  }
}

function kickQueuedJob() {
  const cfg = getConfig_();
  const jobsState = getJobsState_();
  const fileId = Object.keys(jobsState)[0];

  if (!fileId) {
    Logger.log("No tracked job to kick.");
    return;
  }

  const entry = jobsState[fileId];
  const driveAccessToken = ScriptApp.getOAuthToken();

  const res = urlFetchJson_({
    url: cfg.BOOKBYTE_BASE_URL.replace(/\/+$/, "") + "/.netlify/functions/pdf-summary-background",
    method: "post",
    headers: {
      "content-type": "application/json",
      "x-import-secret": cfg.BOOKBYTE_IMPORT_SECRET,
    },
    payload: JSON.stringify({
      jobId: entry.jobId,
      driveFileId: fileId,
      driveAccessToken: driveAccessToken,
    }),
    muteHttpExceptions: true,
  });

  Logger.log(`Kick response HTTP ${res.status}: ${res.text}`);
}

/* ---------------- helpers ---------------- */

function getConfig_() {
  const BOOKBYTE_BASE_URL = mustGetProp_("BOOKBYTE_BASE_URL");
  const BOOKBYTE_IMPORT_SECRET = mustGetProp_("BOOKBYTE_IMPORT_SECRET");
  const SOURCE_FOLDER_ID = mustGetProp_("SOURCE_FOLDER_ID");
  const OUTPUT_FOLDER_ID = mustGetProp_("OUTPUT_FOLDER_ID");
  const DONE_FOLDER_ID = mustGetProp_("DONE_FOLDER_ID");
  const KIMI_MODEL = getProp_("KIMI_MODEL") || "kimi-k2.5";

  return {
    BOOKBYTE_BASE_URL,
    BOOKBYTE_IMPORT_SECRET,
    SOURCE_FOLDER_ID,
    OUTPUT_FOLDER_ID,
    DONE_FOLDER_ID,
    KIMI_MODEL,
  };
}

function toTitleCase_(s) {
  return String(s || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.length ? (w[0].toUpperCase() + w.slice(1)) : w)
    .join(" ");
}

function parseTitleAuthorFromBase_(base) {
  let t = String(base || "").trim();

  // Remove trailing "Summary"
  t = t.replace(/\s*(?:—|–|-)\s*summary\s*$/i, "").trim();
  t = t.replace(/\s*\bsummary\s*$/i, "").trim();

  // Replace underscores with spaces
  t = t.replace(/_/g, " ").replace(/\s+/g, " ").trim();

  // "Title by Author"
  const byMatch = t.match(/^(.*)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { title: byMatch[1].trim(), author: byMatch[2].trim() };
  }

  // "Title - Author" (only when separator has spaces)
  const dashParts = t.split(/\s+(?:—|–|-)\s+/g).map(p => p.trim()).filter(Boolean);
  if (dashParts.length >= 2) {
    const author = dashParts.pop();
    const title = dashParts.join(" - ");
    return { title, author };
  }

  return { title: t, author: null };
}

function cleanSummaryOutputFileName_(originalFileName) {
  const base = stripExt_(originalFileName || "Untitled");
  const parsed = parseTitleAuthorFromBase_(base);

  const title = toTitleCase_(parsed.title || "Untitled");
  const author = parsed.author ? toTitleCase_(parsed.author) : null;

  return author ? `${title} by ${author}.txt` : `${title}.txt`;
}




function pickNextUntrackedPdf_(sourceFolder, jobsState, maxScan) {
  let scanned = 0;
  const it = sourceFolder.getFiles();
  while (it.hasNext() && scanned < maxScan) {
    scanned++;
    const f = it.next();
    const name = f.getName() || "";
    if (!/\.pdf$/i.test(name)) continue;

    const id = f.getId();
    if (jobsState[id]) continue;

    Logger.log(`Found next PDF after scanning ${scanned} file(s): ${name}`);
    return f;
  }

  Logger.log(`Scanned ${scanned} file(s). No untracked PDFs found.`);
  return null;
}

function withRetries_(fn, label) {
  const maxAttempts = 4;
  let delayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return fn();
    } catch (e) {
      const msg = stringifyError_(e);
      const retryable =
        msg.indexOf("We're sorry, a server error occurred") !== -1 ||
        msg.indexOf("Service invoked too many times") !== -1 ||
        msg.indexOf("Internal error") !== -1 ||
        msg.indexOf("Rate Limit Exceeded") !== -1;

      Logger.log(`${label} failed (attempt ${attempt}/${maxAttempts}): ${msg}`);

      if (!retryable || attempt === maxAttempts) throw e;

      Utilities.sleep(delayMs);
      delayMs *= 2;
    }
  }

  throw new Error(`${label} failed after retries`);
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

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function mustGetProp_(key) {
  const v = getProp_(key);
  if (!v) throw new Error(`Missing Script Property: ${key}`);
  return v;
}

function getJobsState_() {
  const raw = getProp_("BOOKBYTE_PDF_JOBS_STATE");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setJobsState_(state) {
  PropertiesService.getScriptProperties().setProperty(
    "BOOKBYTE_PDF_JOBS_STATE",
    JSON.stringify(state || {})
  );
}

function stripExt_(name) {
  return String(name || "").replace(/\.(pdf|epub|txt)$/i, "").trim() || "Untitled";
}

function fileExists_(folder, fileName) {
  const it = folder.getFilesByName(fileName);
  return it.hasNext();
}

function deleteExistingTriggers_() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    const fn = t.getHandlerFunction();
    if (fn === "submitNewPdfJobs" || fn === "pollPdfJobs") {
      ScriptApp.deleteTrigger(t);
    }
  }
}

function stringifyError_(e) {
  try {
    if (e && typeof e === "object") {
      const msg = e.message ? String(e.message) : "";
      const stack = e.stack ? String(e.stack) : "";
      return [msg, stack].filter(Boolean).join(" | ");
    }
    return String(e);
  } catch {
    return "Unknown error";
  }
}

/* ---------------- TEST FUNCTIONS ---------------- */

/**
 * Test function - run this manually to test submitNewPdfJobs() right now
 * This simulates what will happen at 2 AM
 */
function testSubmitNewPdfJobs() {
  Logger.log('=== Starting test run of submitNewPdfJobs() ===');
  Logger.log('Time: ' + new Date().toISOString());
  
  try {
    const cfg = getConfig_();
    Logger.log('✓ Configuration loaded successfully');
    Logger.log('  - Base URL: ' + cfg.BOOKBYTE_BASE_URL);
    Logger.log('  - Source Folder ID: ' + cfg.SOURCE_FOLDER_ID);
    Logger.log('  - Output Folder ID: ' + cfg.OUTPUT_FOLDER_ID);
    Logger.log('  - Done Folder ID: ' + cfg.DONE_FOLDER_ID);
    Logger.log('  - Kimi Model: ' + cfg.KIMI_MODEL);
    
    // Test folder access
    Logger.log('Testing folder access...');
    const sourceFolder = DriveApp.getFolderById(cfg.SOURCE_FOLDER_ID);
    Logger.log('✓ Source folder accessed: ' + sourceFolder.getName());
    
    const outputFolder = DriveApp.getFolderById(cfg.OUTPUT_FOLDER_ID);
    Logger.log('✓ Output folder accessed: ' + outputFolder.getName());
    
    const doneFolder = DriveApp.getFolderById(cfg.DONE_FOLDER_ID);
    Logger.log('✓ Done folder accessed: ' + doneFolder.getName());
    
    // Check current jobs state
    const jobsState = getJobsState_();
    const trackedCount = Object.keys(jobsState).length;
    Logger.log('✓ Currently tracking ' + trackedCount + ' job(s)');
    
    if (trackedCount > 0) {
      Logger.log('⚠️  Warning: There are already tracked jobs. submitNewPdfJobs() will skip.');
      Logger.log('   Tracked jobs: ' + JSON.stringify(jobsState, null, 2));
    }
    
    // Count PDFs in source folder
    const files = sourceFolder.getFiles();
    let pdfCount = 0;
    let totalCount = 0;
    while (files.hasNext()) {
      const file = files.next();
      totalCount++;
      if (/\.pdf$/i.test(file.getName())) {
        pdfCount++;
      }
    }
    Logger.log('✓ Found ' + pdfCount + ' PDF file(s) out of ' + totalCount + ' total file(s)');
    
    // Run the actual function
    Logger.log('Running submitNewPdfJobs()...');
    submitNewPdfJobs();
    
    Logger.log('=== Test completed successfully! ===');
    Logger.log('Check the logs above for any job creation.');
    Logger.log('If a job was created, run testPollPdfJobs() to check its status.');
    
  } catch (error) {
    Logger.log('=== TEST FAILED ===');
    Logger.log('Error: ' + error.toString());
    Logger.log('Stack: ' + (error.stack || 'No stack trace'));
    throw error;
  }
}

/**
 * Test function - run this manually to test pollPdfJobs() right now
 * This simulates what will happen every 15 minutes
 */
function testPollPdfJobs() {
  Logger.log('=== Starting test run of pollPdfJobs() ===');
  Logger.log('Time: ' + new Date().toISOString());
  
  try {
    const cfg = getConfig_();
    Logger.log('✓ Configuration loaded successfully');
    
    // Check current jobs state
    const jobsState = getJobsState_();
    const trackedCount = Object.keys(jobsState).length;
    
    if (trackedCount === 0) {
      Logger.log('⚠️  No tracked jobs found.');
      Logger.log('   Run testSubmitNewPdfJobs() first to create a job,');
      Logger.log('   or add a job manually to BOOKBYTE_PDF_JOBS_STATE property.');
      return;
    }
    
    Logger.log('✓ Found ' + trackedCount + ' tracked job(s)');
    Logger.log('   Jobs: ' + JSON.stringify(jobsState, null, 2));
    
    // Run the actual function
    Logger.log('Running pollPdfJobs()...');
    pollPdfJobs();
    
    Logger.log('=== Test completed successfully! ===');
    Logger.log('Check the logs above for job status updates.');
    Logger.log('If status is "queued", the script will auto-kick the worker.');
    Logger.log('If status is "done", the summary will be saved and PDF moved.');
    
  } catch (error) {
    Logger.log('=== TEST FAILED ===');
    Logger.log('Error: ' + error.toString());
    Logger.log('Stack: ' + (error.stack || 'No stack trace'));
    throw error;
  }
}

/**
 * View current jobs state (useful for debugging)
 */
function viewJobsState() {
  const jobsState = getJobsState_();
  const trackedCount = Object.keys(jobsState).length;
  
  Logger.log('=== Current Jobs State ===');
  Logger.log('Tracked jobs: ' + trackedCount);
  
  if (trackedCount === 0) {
    Logger.log('No jobs currently tracked.');
    return;
  }
  
  Logger.log(JSON.stringify(jobsState, null, 2));
  
  // Try to get status for each job
  const cfg = getConfig_();
  for (const fileId in jobsState) {
    const entry = jobsState[fileId];
    Logger.log('\n--- Job: ' + entry.fileName + ' ---');
    Logger.log('File ID: ' + fileId);
    Logger.log('Job ID: ' + entry.jobId);
    Logger.log('Created: ' + entry.createdAtIso);
    
    try {
      const res = urlFetchJson_({
        url: cfg.BOOKBYTE_BASE_URL.replace(/\/+$/, "") + "/api/pdf-summary-jobs?id=" + encodeURIComponent(entry.jobId),
        method: "get",
        headers: { "x-import-secret": cfg.BOOKBYTE_IMPORT_SECRET },
        muteHttpExceptions: true,
      });
      
      if (res.json) {
        Logger.log('Status: ' + res.json.status);
        Logger.log('Updated: ' + res.json.updatedAt);
        if (res.json.error) {
          Logger.log('Error: ' + res.json.error);
        }
      }
    } catch (e) {
      Logger.log('Could not fetch job status: ' + stringifyError_(e));
    }
  }
}

/**
 * Clear jobs state (useful for testing/resetting)
 */
function clearJobsState() {
  PropertiesService.getScriptProperties().deleteProperty("BOOKBYTE_PDF_JOBS_STATE");
  Logger.log('✓ Jobs state cleared');
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
  Logger.log('Current trigger settings:');
  Logger.log('  - PDF submission: daily at 15:00 (3 PM)');
  Logger.log('  - Job polling: every 15 minutes');
  Logger.log('');
  Logger.log('To change timezone: Project Settings → Time zone');
}
