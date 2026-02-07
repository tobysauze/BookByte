import OpenAI from "openai";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type GenerateCoverParams = {
  bookId: string;
  userId: string;
  title: string;
  author?: string | null;
  description?: string | null;
  category?: string | null;
  existingCoverUrl?: string | null;
  force?: boolean;
  feedback?: string | null;
};

function isGeneratedCoverUrl(url: string) {
  return url.includes("generated-cover-") || url.includes("/generated-cover-");
}

function buildPrompt(args: {
  title: string;
  author: string;
  category?: string | null;
  description?: string | null;
  coverStyleHint?: string | null;
  feedback?: string | null;
}) {
  const { title, author, category, description, coverStyleHint, feedback } = args;

  return [
    "Design an original, simple cartoony book cover in a flat vector / icon style.",
    "Portrait 2:3 book cover composition (1024x1536), centered layout, clean margins, strong readability.",
    "Use a limited color palette (2–4 colors). Smooth shapes, minimal detail, no photorealism.",
    "Place a single bold icon/illustration in the center that hints at the theme.",
    "Typography: big, bold title near top; smaller author name near bottom. Keep text perfectly legible.",
    "No logos, no publisher marks, no trademarks.",
    "Do NOT copy or imitate any existing book cover art exactly. Avoid recognizable compositions or exact typography.",
    coverStyleHint
      ? `Reference cover (for vibe only, do not copy):\n${coverStyleHint}`
      : "",
    category ? `Genre/category vibe: ${category}.` : "",
    description ? `Summary (for mood + icon idea): ${description}` : "",
    feedback ? `IMPORTANT CORRECTIONS/REQUIREMENTS: ${feedback}` : "",
    `Title text must appear exactly: ${title}`,
    `Author text must appear exactly: ${author}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function findReferenceCoverUrl(params: {
  title: string;
  author: string;
}): Promise<string | null> {
  const { title, author } = params;
  const q = `intitle:${title} inauthor:${author}`;

  // 1) Google Books (often has good thumbnails). API key optional.
  try {
    const key = process.env.GOOGLE_BOOKS_API_KEY;
    const url =
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5` +
      (key ? `&key=${encodeURIComponent(key)}` : "");
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      const data = (await res.json()) as any;
      const items = Array.isArray(data?.items) ? data.items : [];
      for (const item of items) {
        const img =
          item?.volumeInfo?.imageLinks?.thumbnail ||
          item?.volumeInfo?.imageLinks?.smallThumbnail;
        if (typeof img === "string" && img.length > 0) {
          // Ensure https (Google sometimes returns http).
          return img.replace(/^http:/, "https:");
        }
      }
    }
  } catch (err) {
    console.error("Google Books cover lookup failed:", err);
  }

  // 2) Open Library search fallback.
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(
      title,
    )}&author=${encodeURIComponent(author)}&limit=5`;
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      const data = (await res.json()) as any;
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      for (const doc of docs) {
        const coverId = doc?.cover_i;
        if (typeof coverId === "number" && Number.isFinite(coverId)) {
          return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
        }
      }
    }
  } catch (err) {
    console.error("Open Library cover lookup failed:", err);
  }

  return null;
}

async function describeExistingCover(openai: OpenAI, imageUrl: string): Promise<string | null> {
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

  try {
    const res = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You describe book covers for designers. Be specific about color palette, layout, iconography, mood, and typography, but do not mention any brand logos.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this book cover so an illustrator can create a new cartoony flat-vector cover with a similar vibe. Include: main icon/scene, dominant colors, background style, typography placement.",
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const text = res.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err) {
    console.error("Cover vision description failed:", err);
    return null;
  }
}

type ForceGenerateParams = GenerateCoverParams & {
  force?: boolean;
  feedback?: string | null;
};

export async function maybeGenerateAndSaveCover({
  bookId,
  userId,
  title,
  author,
  description,
  category,
  existingCoverUrl,
  force = false,
  feedback = null,
}: ForceGenerateParams): Promise<{ coverUrl?: string; skipped: boolean }> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return { skipped: true };
  }

  if (!title.trim()) return { skipped: true };

  // If we don't know the author, skip generation.
  // These covers always include author text; generating "Unknown author" would be wasted effort.
  const authorTrimmed = (author || "").trim();
  const authorLower = authorTrimmed.toLowerCase();
  if (
    !authorTrimmed ||
    authorLower === "unknown" ||
    authorLower === "unknown author" ||
    authorLower === "n/a" ||
    authorLower === "na"
  ) {
    return { skipped: true };
  }

  // If the current cover is already generated by us, don't regenerate (unless forced).
  if (!force && existingCoverUrl && isGeneratedCoverUrl(existingCoverUrl)) {
    return { skipped: true };
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const resolvedAuthor = authorTrimmed;

  // If we don't already have a cover URL, try to find a reference cover online.
  // This is used ONLY to extract "vibe" (colors/layout/icon ideas), never to copy.
  const referenceCoverUrl =
    existingCoverUrl ||
    (await findReferenceCoverUrl({
      title: title.trim(),
      author: resolvedAuthor,
    }).catch(() => null));

  const coverStyleHint = referenceCoverUrl
    ? await describeExistingCover(openai, referenceCoverUrl).catch(() => null)
    : null;

  const prompt = buildPrompt({
    title: title.trim(),
    author: resolvedAuthor,
    category: category ?? null,
    description: description ?? null,
    coverStyleHint,
    feedback: feedback ?? null,
  });

  const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

  let img;
  try {
    img = await openai.images.generate({
      model: imageModel,
      size: "1024x1536",
      prompt,
    });
  } catch (openaiError) {
    const errorMessage = openaiError instanceof Error ? openaiError.message : String(openaiError);
    console.error("OpenAI image generation error:", errorMessage);
    throw new Error(`OpenAI image generation failed: ${errorMessage}`);
  }

  const b64 = img.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI did not return image bytes. Check that the model supports base64 output.");
  }

  const bytes = Buffer.from(b64, "base64");
  const admin = getSupabaseAdminClient();

  // Archive old cover if it exists and is a generated cover
  let archivedCovers: Array<{ url: string; archived_at: string; reason?: string }> = [];
  if (existingCoverUrl && isGeneratedCoverUrl(existingCoverUrl)) {
    try {
      // Fetch current archived_covers from database
      const { data: book } = await admin
        .from("books")
        .select("archived_covers")
        .eq("id", bookId)
        .single();

      archivedCovers = Array.isArray(book?.archived_covers) 
        ? (book.archived_covers as Array<{ url: string; archived_at: string; reason?: string }>)
        : [];

      // Add current cover to archived list
      archivedCovers.push({
        url: existingCoverUrl,
        archived_at: new Date().toISOString(),
        reason: feedback ? `Regenerated with feedback: ${feedback.substring(0, 100)}` : "Regenerated",
      });
    } catch (err) {
      console.warn("Failed to archive old cover:", err);
      // Continue anyway - archiving is best-effort
    }
  }

  const fileName = `generated-cover-${bookId}.png`;
  const storagePath = `${userId}/${fileName}`;

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await admin.storage
    .from("book-files")
    .upload(storagePath, bytes, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadError || !uploadData) {
    console.error("Cover upload error:", uploadError);
    throw new Error("Failed to upload cover image.");
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("book-files").getPublicUrl(uploadData.path);

  // Trigger Google Drive upload via Google Apps Script (best-effort)
  // The script will handle the actual upload using its OAuth token
  const driveFolderId = process.env.GOOGLE_DRIVE_COVERS_FOLDER_ID;
  if (driveFolderId) {
    try {
      const driveFileName = `${title}${author ? ` by ${author}` : ""}.png`;
      const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || "https://bookbytee.netlify.app";
      const secret = process.env.GOOGLE_DRIVE_IMPORT_SECRET;
      
      if (secret) {
        // Note: This endpoint requires driveAccessToken, which Google Apps Script will provide
        // For now, we'll let Google Apps Script poll for new covers
        // Alternatively, you can call this endpoint from Google Apps Script with the token
        console.log(`Cover ready for Google Drive upload: ${publicUrl}`);
      }
    } catch (error) {
      console.warn("Failed to prepare Google Drive upload (continuing anyway):", error);
    }
  }

  // Update book with new cover URL and archived covers
  const { error: updateError } = await admin
    .from("books")
    .update({ 
      cover_url: publicUrl,
      archived_covers: archivedCovers.length > 0 ? archivedCovers : undefined,
    })
    .eq("id", bookId);

  if (updateError) {
    console.error("Cover DB update error:", updateError);
    throw new Error("Failed to update cover_url.");
  }

  return { coverUrl: publicUrl, skipped: false };
}

