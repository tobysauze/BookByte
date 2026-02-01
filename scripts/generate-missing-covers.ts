#!/usr/bin/env tsx

/**
 * Generate missing book covers using OpenAI Images and store them in Supabase Storage.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... \
 *   npx tsx scripts/generate-missing-covers.ts --limit 25
 *
 * Flags:
 *   --limit N     Max books to process (default: 25)
 *   --all         Regenerate covers even if cover_url already exists
 *   --dry-run     Don’t call OpenAI / don’t upload / don’t update DB
 */

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

type BookRow = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  description: string | null;
  category: string | null;
  cover_url: string | null;
};

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildPrompt(book: BookRow) {
  const title = (book.title || "").trim();
  const author = (book.author || "").trim();
  const category = (book.category || "").trim();
  const desc = (book.description || "").trim();

  // We’re intentionally NOT asking it to replicate any existing cover. We only match “vibe” loosely.
  return [
    "Design an original, simple cartoony book cover in a flat vector / icon style.",
    "Portrait 2:3 book cover composition, centered layout, clean margins, strong readability.",
    "Use a limited color palette (2–4 colors). Smooth shapes, minimal detail, no photorealism.",
    "Place a single bold icon/illustration in the center that hints at the theme.",
    "Typography: big, bold title near top; smaller author name near bottom. Keep text perfectly legible.",
    "No logos, no publisher marks, no trademarks.",
    "Do NOT copy or imitate any existing book cover art. Avoid recognizable compositions or exact typography.",
    category ? `Genre/category vibe: ${category}.` : "",
    desc ? `Story/summary (for mood + icon idea): ${desc}` : "",
    `Title: ${title}`,
    author ? `Author: ${author}` : "Author: (unknown)",
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const limit = Number(getArg("--limit") ?? "25");
  const regenerateAll = hasFlag("--all");
  const dryRun = hasFlag("--dry-run");

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!SUPABASE_URL) throw new Error("Missing env SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");
  if (!OPENAI_API_KEY && !dryRun) throw new Error("Missing env OPENAI_API_KEY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Fetch candidate books
  let query = supabase
    .from("books")
    .select("id,user_id,title,author,description,category,cover_url")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!regenerateAll) {
    // Missing/empty cover URLs
    query = query.or("cover_url.is.null,cover_url.eq.");
  }

  const { data, error } = await query;
  if (error) throw error;

  const books = (data ?? []) as BookRow[];

  console.log(
    JSON.stringify(
      {
        limit,
        regenerateAll,
        dryRun,
        fetched: books.length,
      },
      null,
      2
    )
  );

  let processed = 0;
  let skipped = 0;

  for (const book of books) {
    const title = book.title?.trim();
    if (!title) {
      skipped++;
      continue;
    }

    const author = book.author?.trim() || null;

    console.log(`\n[${processed + skipped + 1}/${books.length}] ${book.id} :: ${title}${author ? ` — ${author}` : ""}`);

    const prompt = buildPrompt(book);

    if (dryRun) {
      console.log("DRY RUN: would generate + upload cover");
      processed++;
      continue;
    }

    // Generate cover image (2:3)
    // Using gpt-image-1: supports 1024x1536 which is a clean 2:3 portrait.
    const img = await openai.images.generate({
      model: "gpt-image-1",
      size: "1024x1536",
      prompt,
    });

    const b64 = img.data?.[0]?.b64_json;
    if (!b64) {
      console.error("No image returned from OpenAI");
      continue;
    }

    const bytes = Buffer.from(b64, "base64");

    // Upload to Supabase Storage (same bucket already used by manual cover uploads)
    const fileName = `generated-cover-${book.id}.png`;
    const storagePath = `${book.user_id}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("book-files")
      .upload(storagePath, bytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("book-files").getPublicUrl(uploadData.path);

    const { error: updateError } = await supabase
      .from("books")
      .update({ cover_url: publicUrl })
      .eq("id", book.id);

    if (updateError) {
      console.error("DB update error:", updateError);
      continue;
    }

    console.log("✅ cover_url updated:", publicUrl);
    processed++;

    // Small delay to avoid hammering APIs
    await sleep(350);
  }

  console.log(
    `\nDone. processed=${processed} skipped=${skipped} total=${books.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
