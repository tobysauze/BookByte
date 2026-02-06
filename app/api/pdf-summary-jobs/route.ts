import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function parseTitleAuthorFromFilename(fileName: string): { title: string; author: string | null } {
  const base = fileName.replace(/\.(pdf|epub|txt)$/i, "").trim();
  // Common patterns:
  // - "Title - Author"
  // - "Title — Author"
  // - "Title _ Author"
  // - "Title – Author"
  const parts = base.split(/\s*(?:-+|—|–|_)\s*/g).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const author = parts.pop() ?? "";
    const title = parts.join(" - ");
    return { title: title || base, author: author || null };
  }
  return { title: base || "Untitled", author: null };
}

const createJobSchema = z
  .object({
    // Option A: server downloads PDF directly
    sourceUrl: z.string().url().optional(),

    // Option B: server downloads from Drive using a short-lived OAuth token
    driveFileId: z.string().min(1).optional(),
    driveAccessToken: z.string().min(1).optional(),

    fileName: z.string().min(1),
    title: z.string().min(1).optional(),
    author: z.string().min(1).optional().nullable(),
    model: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.sourceUrl) || (Boolean(v.driveFileId) && Boolean(v.driveAccessToken)), {
    message: "Provide sourceUrl or (driveFileId + driveAccessToken).",
  });

/**
 * Create a PDF summary job (runs in Netlify background).
 *
 * The source URL should be publicly fetchable by the server (e.g. a public Google Drive download URL).
 */
export async function POST(request: NextRequest) {
  try {
    const secret = getRequiredEnv("GOOGLE_DRIVE_IMPORT_SECRET");
    const header = request.headers.get("x-import-secret");
    if (!header || header !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = createJobSchema.parse(await request.json());
    const inferred = parseTitleAuthorFromFilename(body.fileName);
    const title = body.title ?? inferred.title;
    const author = body.author ?? inferred.author;

    const admin = getSupabaseAdminClient();
    const { data: job, error } = await admin
      .from("pdf_summary_jobs")
      .insert({
        status: "queued",
        source_url: body.sourceUrl ?? null,
        source_file_name: body.fileName,
        title,
        author,
        model: body.model ?? null,
        prompt_version: "kimi-k2.5-deep-dive-v1",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !job) {
      console.error(error);
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
    }

    // Kick off background processing on Netlify (best-effort).
    // If this fails, the job can be retried by calling the background function directly.
    try {
      const origin = request.nextUrl.origin;
      await fetch(`${origin}/.netlify/functions/pdf-summary-background`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-import-secret": secret,
        },
        // Do NOT store driveAccessToken in DB; pass it through to the worker for immediate download.
        body: JSON.stringify({
          jobId: job.id,
          sourceUrl: body.sourceUrl ?? null,
          driveFileId: body.driveFileId ?? null,
          driveAccessToken: body.driveAccessToken ?? null,
        }),
      });
    } catch (e) {
      console.warn("Failed to start background summarization:", e);
    }

    const res = NextResponse.json({ jobId: job.id }, { status: 200 });
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const secret = getRequiredEnv("GOOGLE_DRIVE_IMPORT_SECRET");
    const header = request.headers.get("x-import-secret");
    if (!header || header !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobId = request.nextUrl.searchParams.get("id");
    if (!jobId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: job, error } = await admin
      .from("pdf_summary_jobs")
      .select("id,status,title,author,model,prompt_version,result_text,error_message,created_at,updated_at")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      console.error(error);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const res = NextResponse.json(
      {
        id: job.id,
        status: job.status,
        title: job.title,
        author: job.author,
        model: job.model,
        promptVersion: job.prompt_version,
        resultText: job.status === "done" ? job.result_text : null,
        error: job.status === "error" ? job.error_message : null,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      },
      { status: 200 },
    );
    res.headers.set("Cache-Control", "no-store, max-age=0");
    res.headers.set("Vary", "Cookie");
    return res;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

