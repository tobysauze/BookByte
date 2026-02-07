import { getSupabaseAdminClient } from "../../lib/supabase-admin";
import pdfParse from "pdf-parse";

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const DEEP_DIVE_PROMPT = `You are an expert book summarizer and synthesis analyst. Your task is to create a comprehensive, high-value summary of the attached PDF book following the exact structure below. The total output must be between 5,000-20,000 words. Analyze the book deeply—extract not just what is said, but why it matters, how it connects to broader ideas, and how readers can apply it.

STRUCTURE:

═══════════════════════════════════════════════════════════
PART 1: ONE-PAGE EXECUTIVE SUMMARY (500-800 words)
═══════════════════════════════════════════════════════════

Provide a dense, high-level overview covering:
- Core thesis/central argument in 2-3 sentences
- Why this book matters now (context and relevance)
- The promised transformation for readers
- Key methodology or framework introduced
- Who should read this and what they'll gain

═══════════════════════════════════════════════════════════
PART 2: CHAPTER-BY-CHAPTER DEEP DIVE (60-70% of total word count)
═══════════════════════════════════════════════════════════

For EACH chapter, provide:

**Chapter [Number]: [Title]**

**Summary (300-600 words):**
- Core arguments and evidence presented
- Key stories, case studies, or examples with specific details
- Logical progression of ideas
- How this chapter builds on previous chapters

**Extended Commentary & Context (200-400 words):**
- Connect ideas to other well-known works in the field
- Identify assumptions, biases, or limitations in the author's reasoning
- Note any controversial or debated points
- Suggest practical applications or real-world implications

**Key Techniques/Routines/Procedures:**
- List any specific methods, frameworks, or systems introduced
- Include step-by-step breakdowns where applicable
- Note any metrics, tracking systems, or evaluation criteria

**Practical Exercises (if any):**
- Describe any homework, reflection questions, or implementation activities

[Continue for every chapter, including introduction, conclusion, and any appendices]

═══════════════════════════════════════════════════════════
PART 3: KEY INSIGHTS & FRAMEWORKS (800-1,500 words)
═══════════════════════════════════════════════════════════

**Core Frameworks:**
- Visual representation of key models (describe in text)
- Relationships between concepts
- Decision trees or flowcharts the author uses

**Contrarian or Novel Ideas:**
- What does this author argue that contradicts conventional wisdom?
- What unique perspective or synthesis do they offer?

**Evidence Quality Assessment:**
- What types of evidence does the author use? (studies, anecdotes, expert interviews, data)
- Strengths and limitations of their argumentation
- Any claims that need verification or are overstated

═══════════════════════════════════════════════════════════
PART 4: ACTIONABLE RECOMMENDATIONS (800-1,200 words)
═══════════════════════════════════════════════════════════

**For Different Reader Profiles:**
- Beginners/new to the topic: First 3 actions to take
- Intermediate practitioners: How to deepen application
- Experts/advanced: How to integrate or challenge these ideas

**Implementation Roadmap:**
- Week 1-2: Foundation setting
- Month 1: Habit building
- Month 3+: Mastery and refinement

**Habit Stacking Suggestions:**
- Pair these practices with existing routines
- Environmental design recommendations
- Accountability systems

**Potential Pitfalls & How to Avoid Them:**
- Common misinterpretations of the book's advice
- Ways people typically fail implementing these ideas
- Modifications for different life circumstances (parents, shift workers, executives, etc.)

═══════════════════════════════════════════════════════════
PART 5: QUOTABLE PASSAGES & KEY DEFINITIONS (500-800 words)
═══════════════════════════════════════════════════════════

**Signature Quotes (10-15):**
- Include exact quotes with page references
- Brief context for why each matters
- How to apply each quote practically

**Key Terminology:**
- Author's specific definitions for important terms
- Distinctions between similar concepts in the book
- Any neologisms or coined phrases

**Metaphors & Analogies:**
- Central metaphors the author uses
- How these shape understanding
- Potential limitations of these metaphors

═══════════════════════════════════════════════════════════
PART 6: AUTHOR CONTEXT & BOOK PROVENANCE (400-600 words)
═══════════════════════════════════════════════════════════

**About the Author:**
- Credentials and background
- What qualifies them to write this?
- Their broader body of work and how this fits
- Any stated or apparent biases

**Publication Context:**
- When published and what was happening in the world/field at that time
- How the book was received (critical acclaim, controversy, commercial success)
- Influence on subsequent thinking or practices
- Whether ideas have been updated, challenged, or superseded since publication

**Intellectual Lineage:**
- Direct influences on the author
- This book's influence on later works
- Where it fits in the broader conversation

═══════════════════════════════════════════════════════════
PART 7: SYNTHESIS & CRITICAL ASSESSMENT (600-1,000 words)
═══════════════════════════════════════════════════════════

**Strengths:**
- What this book does exceptionally well
- Who will benefit most and why
- Scenarios where these ideas shine

**Limitations & Gaps:**
- What's missing, underdeveloped, or oversimplified?
- Populations or contexts not well served by this advice
- Outdated elements (if applicable)

**Comparison to Similar Works:**
- 2-3 similar books and how this differs
- Whether to read this first, second, or instead of others
- Unique contribution to the field

**The "So What?" Test:**
- If someone reads and implements everything, what realistically changes?
- What's the magnitude of potential impact?
- Sustainability of recommended practices

═══════════════════════════════════════════════════════════
PART 8: QUICK REFERENCE TOOLS (300-500 words)
═══════════════════════════════════════════════════════════

**One-Page Cheat Sheet:**
- Core principles in bullet form
- Decision criteria for key choices
- Warning signs you're off track

**Reading Guide:**
- If short on time: Read only these chapters
- If deeply interested: Pay special attention to these sections
- If skeptical: Start here to evaluate claims

**Discussion Questions:**
- 5-7 questions for book clubs or study groups
- Questions to test understanding vs. questions to spark debate

TONE & STYLE GUIDELINES:
1. Depth over breadth
2. Critical but fair
3. Practical orientation
4. Conversational authority
5. Cross-pollination
6. Specificity (include page references where possible)
7. Voice preservation

Now process the attached PDF and generate the complete summary following this structure exactly.`;

function buildPagedText(pages: string[]) {
  return pages
    .map((t, idx) => `\n\n[PAGE ${idx + 1}]\n${(t || "").trim()}\n`)
    .join("")
    .trim();
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : typeof value === "number" ? Math.trunc(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

async function fetchWithRetries(
  url: string,
  init: RequestInit,
  label: string,
  attempts = 3,
): Promise<Response> {
  let lastErr: unknown = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, init);
      return res;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[pdf-summary] ${label} fetch attempt ${i}/${attempts} failed: ${msg}`);
      // Exponential-ish backoff: 1s, 2s, 4s...
      const delayMs = 1000 * Math.pow(2, i - 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`${label} failed: ${msg}`);
}

async function downloadPdf(params: { sourceUrl?: string | null; driveFileId?: string | null; driveAccessToken?: string | null }) {
  if (params.sourceUrl) {
    const res = await fetchWithRetries(
      params.sourceUrl,
      { method: "GET" },
      "Download PDF from sourceUrl",
      3,
    );
    if (!res.ok) throw new Error(`Failed to download PDF from sourceUrl: ${res.status} ${res.statusText}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  if (params.driveFileId && params.driveAccessToken) {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.driveFileId)}?alt=media`;
    const res = await fetchWithRetries(
      url,
      { method: "GET", headers: { Authorization: `Bearer ${params.driveAccessToken}` } },
      "Download PDF from Google Drive",
      3,
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Failed to download PDF from Google Drive: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  throw new Error("Missing sourceUrl or (driveFileId + driveAccessToken).");
}

type KimiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  partial?: boolean;
  name?: string;
};

type KimiChatResult = {
  content: string;
  finishReason: string | null;
};

async function callKimiChat(params: {
  model: string;
  messages: KimiMessage[];
  maxTokens: number;
}) : Promise<KimiChatResult> {
  // Moonshot/Kimi API is OpenAI-compatible. Docs:
  // - Base URL: https://api.moonshot.ai/v1
  // - POST /chat/completions
  const apiKey = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: MOONSHOT_API_KEY");
  }

  // Moonshot docs reference both api.moonshot.ai and api.moonshot.cn in examples.
  // Some hosts/environments have intermittent DNS/TLS routing issues to one or the other,
  // so we try the configured base URL first, then fall back.
  const primaryBaseUrl = (process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1").replace(/\/+$/, "");
  const fallbackBaseUrl = (process.env.MOONSHOT_FALLBACK_BASE_URL || "https://api.moonshot.cn/v1").replace(/\/+$/, "");

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    max_tokens: params.maxTokens,
  };

  // kimi-k2.5 has fixed sampling parameters; sending temperature/top_p/etc can error.
  if (params.model === "kimi-k2.5") {
    body.thinking = { type: "enabled" };
  } else {
    body.temperature = 0.35;
  }

  // Hard timeout so jobs don't get stuck in "running" forever.
  // If this triggers, the worker will throw and mark the job as error.
  const timeoutMs = clampInt(process.env.PDF_SUMMARY_KIMI_TIMEOUT_MS, 12 * 60_000, 30_000, 20 * 60_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const doRequest = async (baseUrl: string, which: "primary" | "fallback") => {
    const endpoint = `${baseUrl}/chat/completions`;
    try {
      return await fetchWithRetries(
        endpoint,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
        `Kimi API (${which})`,
        3,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Kimi API (${which}) request failed: ${msg}`);
    }
  };

  let res: Response;
  try {
    res = await doRequest(primaryBaseUrl, "primary");
  } catch (e1) {
    console.warn("[pdf-summary] Primary Kimi base URL failed, trying fallback.", e1);
    res = await doRequest(fallbackBaseUrl, "fallback");
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Kimi API error: ${res.status} ${res.statusText}${errText ? ` - ${errText}` : ""}`);
  }

  const data: unknown = await res.json();
  const parsed = (() => {
    if (!data || typeof data !== "object") return null;
    const choices = (data as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) return null;
    const first = choices[0];
    if (!first || typeof first !== "object") return null;
    const message = (first as { message?: unknown }).message;
    if (!message || typeof message !== "object") return null;
    const c = (message as { content?: unknown }).content;
    const finish = (first as { finish_reason?: unknown }).finish_reason;
    return {
      content: typeof c === "string" ? c : null,
      finishReason: typeof finish === "string" ? finish : null,
    };
  })();
  if (!parsed || typeof parsed.content !== "string" || parsed.content.trim().length === 0) {
    throw new Error("Kimi API returned empty content.");
  }
  return { content: parsed.content.trim(), finishReason: parsed.finishReason };
}

// Netlify background function handler (keep runtime deps minimal).
export const handler = async (event: { headers?: Record<string, string | undefined>; body?: string | null }) => {
  const admin = getSupabaseAdminClient();

  try {
    const secret = getRequiredEnv("GOOGLE_DRIVE_IMPORT_SECRET");
    const headers = event.headers ?? {};
    const header =
      headers["x-import-secret"] || headers["X-Import-Secret"] || headers["x-import-secret".toLowerCase()];

    if (!header || header !== secret) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const jobId = typeof body.jobId === "string" ? body.jobId : null;
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : null;
    const driveFileId = typeof body.driveFileId === "string" ? body.driveFileId : null;
    const driveAccessToken = typeof body.driveAccessToken === "string" ? body.driveAccessToken : null;

    if (!jobId) {
      return { statusCode: 400, body: JSON.stringify({ error: "jobId is required" }) };
    }

    const { data: job, error: jobErr } = await admin
      .from("pdf_summary_jobs")
      .select("id,status,title,author,model,source_url,source_file_name,source_text,result_text,updated_at")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return { statusCode: 404, body: JSON.stringify({ error: "Job not found" }) };
    }

    if (job.status === "done") {
      return { statusCode: 200, body: JSON.stringify({ success: true, status: "done" }) };
    }

    // If a previous run set status=running but then the worker died, the job can get stuck forever.
    // Treat very old "running" jobs as re-queueable.
    if (job.status === "running") {
      const updatedAtMs = job.updated_at ? Date.parse(String(job.updated_at)) : NaN;
      const staleAfterMs = clampInt(process.env.PDF_SUMMARY_STALE_RUNNING_MS, 30 * 60_000, 60_000, 6 * 60 * 60_000);
      if (Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs > staleAfterMs) {
        await admin
          .from("pdf_summary_jobs")
          .update({ status: "queued", updated_at: new Date().toISOString() })
          .eq("id", jobId);
        (job as any).status = "queued";
      }
    }

    await admin
      .from("pdf_summary_jobs")
      .update({ status: "running", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    // Persist extracted text so we can resume multi-chunk generation across invocations.
    let sourceText = typeof (job as any).source_text === "string" ? ((job as any).source_text as string) : "";
    if (!sourceText) {
      const pdfBuffer = await downloadPdf({
        sourceUrl: sourceUrl ?? job.source_url ?? null,
        driveFileId,
        driveAccessToken,
      });

      const pages: string[] = [];
      await pdfParse(pdfBuffer, {
        max: 500,
        pagerender: async (pageData: unknown) => {
          const maybeTextContent = await (pageData as { getTextContent?: () => Promise<unknown> }).getTextContent?.();
          const itemsRaw = maybeTextContent && typeof maybeTextContent === "object"
            ? (maybeTextContent as { items?: unknown }).items
            : undefined;
          const items = Array.isArray(itemsRaw) ? itemsRaw : [];

          const pageText = items
            .map((item: unknown) => {
              if (typeof item === "string") return item;
              if (item && typeof item === "object" && "str" in item) {
                const s = (item as { str?: unknown }).str;
                return typeof s === "string" ? s : "";
              }
              return "";
            })
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          pages.push(pageText);
          return pageText;
        },
      });

      const pagedText = buildPagedText(pages);
      if (!pagedText) throw new Error("No text extracted from PDF.");

      // If the PDF is extremely large, trim to reduce risk of exceeding context.
      const MAX_SOURCE_CHARS = clampInt(process.env.PDF_SUMMARY_MAX_SOURCE_CHARS, 1_200_000, 50_000, 2_000_000);
      sourceText = pagedText.length > MAX_SOURCE_CHARS ? pagedText.slice(0, MAX_SOURCE_CHARS) : pagedText;

      // Store it for future continuation runs.
      await admin
        .from("pdf_summary_jobs")
        .update({ source_text: sourceText, updated_at: new Date().toISOString() })
        .eq("id", jobId);
    }

    const model =
      (job.model as string) ||
      process.env.KIMI_MODEL ||
      // Backwards-compat (older env name used when routing via OpenRouter)
      process.env.KIMI_OPENROUTER_MODEL ||
      "kimi-k2.5";

    const existing = typeof (job as any).result_text === "string" ? ((job as any).result_text as string) : "";
    const maxTokens = clampInt(process.env.PDF_SUMMARY_MAX_TOKENS, 7000, 800, 20000);

    // Multi-chunk generation:
    // - Always include the extracted PDF text as context (system message)
    // - If we already have partial output, use Partial Mode to "prefix" it and continue.
    const messages: KimiMessage[] = [
      { role: "system", content: "You are a careful, thorough book summarizer. Follow the user prompt exactly." },
      { role: "system", content: `PDF TEXT (with page markers):\n${sourceText}` },
      {
        role: "user",
        content:
          `${DEEP_DIVE_PROMPT}\n\n` +
          `IMPORTANT: This response may be generated across multiple calls. ` +
          `Do not repeat yourself. Continue seamlessly where you left off. ` +
          `Do NOT wrap in markdown code blocks. Output plain text only.`,
      },
    ];
    if (existing.trim().length > 0) {
      messages.push({ role: "assistant", content: existing, partial: true });
    }

    const chunk = await callKimiChat({ model, messages, maxTokens });
    const combined = existing ? `${existing}${existing.endsWith("\n") ? "" : "\n"}${chunk.content}` : chunk.content;

    const isComplete = chunk.finishReason !== "length";

    await admin
      .from("pdf_summary_jobs")
      .update({
        status: isComplete ? "done" : "queued",
        result_text: combined,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return { statusCode: 200, body: JSON.stringify({ success: true, status: isComplete ? "done" : "queued" }) };
  } catch (err) {
    console.error(err);
    // Best-effort: mark job as errored if we can infer jobId.
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const jobId = typeof body.jobId === "string" ? body.jobId : null;
      if (jobId) {
        await admin
          .from("pdf_summary_jobs")
          .update({
            status: "error",
            error_message: err instanceof Error ? err.message : "Server error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    } catch {
      // ignore
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }),
    };
  }
};

