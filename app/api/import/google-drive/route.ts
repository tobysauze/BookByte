import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { calculateBookMetadata } from "@/lib/metadata-utils";
import { rawTextSummarySchema, summarySchema } from "@/lib/schemas";

export const runtime = "nodejs";

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const importBodySchema = z.object({
  ownerUserId: z.string().uuid().optional(),
  title: z.string().min(1),
  author: z.string().min(1).optional().nullable(),
  text: z.string().min(1),
  isPublic: z.boolean().optional(),
  source: z.string().optional(),
});

function looksLikeDeepDivePromptOutput(text: string) {
  const t = text.toLowerCase();
  return (
    /\bpart\s+1\s*:/i.test(t) &&
    /\bpart\s+2\s*:/i.test(t) &&
    /\bpart\s+8\s*:/i.test(t) &&
    (t.includes("chapter-by-chapter") || t.includes("chapter by chapter"))
  );
}

export async function POST(request: NextRequest) {
  try {
    const secret = getRequiredEnv("GOOGLE_DRIVE_IMPORT_SECRET");
    const header = request.headers.get("x-import-secret");
    if (!header || header !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = importBodySchema.parse(await request.json());
    const admin = getSupabaseAdminClient();

    const ownerUserId = body.ownerUserId ?? getRequiredEnv("GOOGLE_DRIVE_IMPORT_OWNER_USER_ID");

    // Prefer saving deep-dive prompt output losslessly as raw_text.
    // Otherwise, try to parse JSON if the file is JSON-like and matches our schema.
    const trimmed = body.text.trim();
    let summary: unknown;

    if (looksLikeDeepDivePromptOutput(trimmed)) {
      summary = rawTextSummarySchema.parse({
        raw_text: trimmed,
        ai_provider: body.source || "google_drive",
      });
    } else {
      // Best-effort: if it's JSON and matches summarySchema, store structured.
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        summary = summarySchema.parse(parsed);
      } catch {
        summary = rawTextSummarySchema.parse({
          raw_text: trimmed,
          ai_provider: body.source || "google_drive",
        });
      }
    }

    const metadata = calculateBookMetadata(summary);

    const { data, error } = await admin
      .from("books")
      .insert({
        user_id: ownerUserId,
        title: body.title,
        author: body.author ?? null,
        summary,
        is_public: body.isPublic ?? false,
        ...metadata,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error(error);
      return NextResponse.json({ error: "Failed to create book" }, { status: 500 });
    }

    return NextResponse.json({ bookId: data.id }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

