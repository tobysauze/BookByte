/**
 * BookByte PDF -> Kimi summary automation (Google Apps Script)
 *
 * Scheduled + priority behavior:
 * - submitScheduledPdfJobs() runs 4x/day (evenly spaced) and submits at most ONE PDF each run
 * - submitPriorityPdfJobs() scans a priority folder frequently and submits at most ONE PDF per scan
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
 *  - PRIORITY_SOURCE_FOLDER_ID     (if set, files in this folder are picked up by submitPriorityPdfJobs)
 *  - SCHEDULED_SUBMIT_HOURS        (default "0,6,12,18")
 *  - PRIORITY_SCAN_MINUTES         (default "5")
 *  - JOB_POLL_INTERVAL_MINUTES     (default "15")
 *  - KIMI_MODEL (default "kimi-k2.5")
 *  - MAX_SCAN_FILES (default "200")
 */

function install() {
  deleteExistingTriggers_();

  const submitHours = parseScheduledSubmitHours_(getProp_("SCHEDULED_SUBMIT_HOURS"));
  const priorityScanMinutes = normalizeEveryMinutes_(getProp_("PRIORITY_SCAN_MINUTES"), 5);
  const pollIntervalMinutes = normalizeEveryMinutes_(getProp_("JOB_POLL_INTERVAL_MINUTES"), 15);

  submitHours.forEach(hour => {
    ScriptApp.newTrigger("submitScheduledPdfJobs")
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .create();
  });

  ScriptApp.newTrigger("submitPriorityPdfJobs")
    .timeBased()
    .everyMinutes(priorityScanMinutes)
    .create();

  ScriptApp.newTrigger("pollPdfJobs")
    .timeBased()
    .everyMinutes(pollIntervalMinutes)
    .create();

  Logger.log("Installed triggers for scheduled + priority PDF processing.");
  Logger.log("Scheduled submission hours: " + submitHours.join(", "));
  Logger.log("Priority folder scan: every " + priorityScanMinutes + " minutes");
  Logger.log("Job polling: every " + pollIntervalMinutes + " minutes");
}

function submitScheduledPdfJobs() {
  submitNextPdfJobFromFolder_("scheduled", getConfig_().SOURCE_FOLDER_ID);
}

function submitPriorityPdfJobs() {
  const cfg = getConfig_();
  if (!cfg.PRIORITY_SOURCE_FOLDER_ID) {
    Logger.log("submitPriorityPdfJobs: PRIORITY_SOURCE_FOLDER_ID not set. Skipping.");
    return;
  }
  submitNextPdfJobFromFolder_("priority", cfg.PRIORITY_SOURCE_FOLDER_ID);
}

// Backwards-compatible function name used by older triggers/scripts.
function submitNewPdfJobs() {
  submitScheduledPdfJobs();
}

function submitNextPdfJobFromFolder_(sourceLabel, sourceFolderId) {
  try {
    const cfg = getConfig_();
    const jobsState = getJobsState_();

    // Enforce "one at a time": if a job is already tracked, do nothing.
    const trackedCount = Object.keys(jobsState).length;
    if (trackedCount > 0) {
      Logger.log(
        `submitNextPdfJobFromFolder_(${sourceLabel}): ${trackedCount} job(s) already tracked. Skipping new submission.`
      );
      return;
    }

    const maxScan = Number(getProp_("MAX_SCAN_FILES") || "200");

    const source = withRetries_(
      () => DriveApp.getFolderById(sourceFolderId),
      `DriveApp.getFolderById(${sourceLabel})`
    );

    const nextPdf = withRetries_(
      () => pickNextUntrackedPdf_(source, jobsState, maxScan),
      `pickNextUntrackedPdf_(${sourceLabel})`
    );

    if (!nextPdf) {
      Logger.log(`submitNextPdfJobFromFolder_(${sourceLabel}): No untracked PDFs found.`);
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
        sourceLabel: sourceLabel,
        createdAtIso: new Date().toISOString(),
      };
      setJobsState_(jobsState);
      Logger.log(`Created ${sourceLabel} job for ${fileName}: ${jobId}`);
      return;
    }

    Logger.log(
      `Failed to create ${sourceLabel} job for ${fileName}. HTTP ${res.status}. Body: ${res.text}`
    );
  } catch (e) {
    Logger.log(`submitNextPdfJobFromFolder_(${sourceLabel}) crashed: ${stringifyError_(e)}`);
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

      // Auto-import into BookByte immediately
      try {
        importToBookByte_(cfg, entry.fileName, resultText);
      } catch (importErr) {
        Logger.log(`Auto-import failed (summary is still saved to Drive): ${stringifyError_(importErr)}`);
      }

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

/* ---------------- auto-import helper ---------------- */

function importToBookByte_(cfg, originalFileName, summaryText) {
  const base = stripExt_(originalFileName || "Untitled");
  const parsed = parseTitleAuthorFromBase_(base);
  const title = toTitleCase_(parsed.title || "Untitled");
  const author = parsed.author ? toTitleCase_(parsed.author) : null;

  const importUrl = cfg.BOOKBYTE_BASE_URL.replace(/\/+$/, "") + "/api/import/google-drive";
  const coverBgUrl = cfg.BOOKBYTE_BASE_URL.replace(/\/+$/, "") + "/.netlify/functions/generate-cover-background";

  const payload = {
    title: title,
    author: author,
    text: summaryText,
    isPublic: false,
    source: "google_drive",
  };

  const res = withRetries_(
    () =>
      urlFetchJson_({
        url: importUrl,
        method: "post",
        headers: {
          "content-type": "application/json",
          "x-import-secret": cfg.BOOKBYTE_IMPORT_SECRET,
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      }),
    "POST /api/import/google-drive"
  );

  if (!(res.status >= 200 && res.status < 300) || !res.json || !res.json.bookId) {
    Logger.log(`BookByte import failed. HTTP ${res.status}. Body: ${res.text}`);
    return;
  }

  const bookId = res.json.bookId;
  Logger.log(`Imported into BookByte: "${title}" -> bookId: ${bookId}`);

  // Trigger cover generation (non-blocking)
  try {
    const coverRes = urlFetchJson_({
      url: coverBgUrl,
      method: "post",
      headers: {
        "content-type": "application/json",
        "x-import-secret": cfg.BOOKBYTE_IMPORT_SECRET,
      },
      payload: JSON.stringify({ bookId: bookId }),
      muteHttpExceptions: true,
    });

    if (coverRes.status >= 200 && coverRes.status < 300) {
      Logger.log(`Cover generation triggered for bookId: ${bookId}`);
    } else {
      Logger.log(`Cover generation trigger failed: HTTP ${coverRes.status}`);
    }
  } catch (coverErr) {
    Logger.log(`Cover generation trigger threw: ${stringifyError_(coverErr)}`);
  }
}

/* ---------------- helpers ---------------- */

function getConfig_() {
  const BOOKBYTE_BASE_URL = mustGetProp_("BOOKBYTE_BASE_URL");
  const BOOKBYTE_IMPORT_SECRET = mustGetProp_("BOOKBYTE_IMPORT_SECRET");
  const SOURCE_FOLDER_ID = mustGetProp_("SOURCE_FOLDER_ID");
  const PRIORITY_SOURCE_FOLDER_ID = getProp_("PRIORITY_SOURCE_FOLDER_ID");
  const OUTPUT_FOLDER_ID = mustGetProp_("OUTPUT_FOLDER_ID");
  const DONE_FOLDER_ID = mustGetProp_("DONE_FOLDER_ID");
  const KIMI_MODEL = getProp_("KIMI_MODEL") || "kimi-k2.5";

  return {
    BOOKBYTE_BASE_URL,
    BOOKBYTE_IMPORT_SECRET,
    SOURCE_FOLDER_ID,
    PRIORITY_SOURCE_FOLDER_ID,
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

  // Strip common PDF download-site prefixes/suffixes from filenames
  t = t.replace(/^[_\s]*OceanofPDF\.com[_\s]*/i, "");
  t = t.replace(/[_\s]*OceanofPDF\.com[_\s]*$/i, "");
  t = t.replace(/^[_\s]*(?:www\.)?z-lib\.org[_\s]*/i, "");
  t = t.replace(/^[_\s]*(?:www\.)?libgen\.\w+[_\s]*/i, "");
  t = t.replace(/^[_\s]*(?:www\.)?pdfdrive\.com[_\s]*/i, "");
  t = t.replace(/^[_\s]*\(?(?:www\.)?[\w-]+\.(?:com|org|net|io)\)?[_\s]*[-–—]?\s*/i, function(match) {
    // Only strip if it looks like a website prefix (not a real title word)
    if (/\.(com|org|net|io)/i.test(match)) return "";
    return match;
  });

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
    if (
      fn === "submitNewPdfJobs" ||
      fn === "submitScheduledPdfJobs" ||
      fn === "submitPriorityPdfJobs" ||
      fn === "pollPdfJobs"
    ) {
      ScriptApp.deleteTrigger(t);
    }
  }
}

function parseScheduledSubmitHours_(raw) {
  const fallback = [0, 6, 12, 18];
  const text = String(raw || "").trim();
  if (!text) return fallback;

  const parsed = text
    .split(",")
    .map(part => Number(String(part).trim()))
    .filter(n => Number.isInteger(n) && n >= 0 && n <= 23);

  const uniqueSorted = Array.from(new Set(parsed)).sort((a, b) => a - b);
  return uniqueSorted.length > 0 ? uniqueSorted : fallback;
}

function normalizeEveryMinutes_(raw, fallback) {
  const allowed = [1, 5, 10, 15, 30];
  const n = Number(raw || fallback);
  if (allowed.indexOf(n) !== -1) return n;
  return fallback;
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
 * Test function - run this manually to test scheduled source submission right now.
 */
function testSubmitNewPdfJobs() {
  Logger.log('=== Starting test run of submitScheduledPdfJobs() ===');
  Logger.log('Time: ' + new Date().toISOString());
  
  try {
    const cfg = getConfig_();
    Logger.log('✓ Configuration loaded successfully');
    Logger.log('  - Base URL: ' + cfg.BOOKBYTE_BASE_URL);
    Logger.log('  - Source Folder ID: ' + cfg.SOURCE_FOLDER_ID);
    Logger.log('  - Priority Source Folder ID: ' + (cfg.PRIORITY_SOURCE_FOLDER_ID || '(not set)'));
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
      Logger.log('⚠️  Warning: There are already tracked jobs. submitScheduledPdfJobs() will skip.');
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
    Logger.log('Running submitScheduledPdfJobs()...');
    submitScheduledPdfJobs();
    
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
 * Test function - run this manually to test priority folder submission right now.
 */
function testSubmitPriorityPdfJobs() {
  Logger.log('=== Starting test run of submitPriorityPdfJobs() ===');
  Logger.log('Time: ' + new Date().toISOString());

  try {
    const cfg = getConfig_();
    if (!cfg.PRIORITY_SOURCE_FOLDER_ID) {
      Logger.log('⚠️  PRIORITY_SOURCE_FOLDER_ID is not set.');
      Logger.log('Set it in Script Properties, then re-run this test.');
      return;
    }

    const priorityFolder = DriveApp.getFolderById(cfg.PRIORITY_SOURCE_FOLDER_ID);
    Logger.log('✓ Priority folder accessed: ' + priorityFolder.getName());

    Logger.log('Running submitPriorityPdfJobs()...');
    submitPriorityPdfJobs();

    Logger.log('=== Test completed successfully! ===');
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
  Logger.log('Current trigger settings (based on Script Properties/defaults):');
  Logger.log('  - Scheduled submission hours: ' + parseScheduledSubmitHours_(getProp_("SCHEDULED_SUBMIT_HOURS")).join(', '));
  Logger.log('  - Priority folder scan: every ' + normalizeEveryMinutes_(getProp_("PRIORITY_SCAN_MINUTES"), 5) + ' minutes');
  Logger.log('  - Job polling: every ' + normalizeEveryMinutes_(getProp_("JOB_POLL_INTERVAL_MINUTES"), 15) + ' minutes');
  Logger.log('');
  Logger.log('To change timezone: Project Settings → Time zone');
}
