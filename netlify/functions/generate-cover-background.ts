import { getSupabaseAdminClient } from "../../lib/supabase-admin";
import { maybeGenerateAndSaveCover } from "../../lib/cover-generator";

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

// Netlify Functions handler (keep runtime deps minimal).
export const handler = async (event: any) => {
  try {
    const secret = getRequiredEnv("GOOGLE_DRIVE_IMPORT_SECRET");
    const header =
      event.headers["x-import-secret"] ||
      event.headers["X-Import-Secret"] ||
      event.headers["x-import-secret".toLowerCase()];

    if (!header || header !== secret) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const bookId = typeof body.bookId === "string" ? body.bookId : null;
    const force = body.force === true;
    const feedback = typeof body.feedback === "string" ? body.feedback : null;

    if (!bookId) {
      return { statusCode: 400, body: JSON.stringify({ error: "bookId is required" }) };
    }

    const admin = getSupabaseAdminClient();
    const { data: book, error } = await admin
      .from("books")
      .select("id, user_id, title, author, description, category, cover_url")
      .eq("id", bookId)
      .single();

    if (error || !book) {
      return { statusCode: 404, body: JSON.stringify({ error: "Book not found" }) };
    }

    // Kick off generation (this function is deployed as a background function on Netlify).
    await maybeGenerateAndSaveCover({
      bookId: book.id,
      userId: book.user_id,
      title: book.title,
      author: book.author,
      description: book.description,
      category: book.category,
      existingCoverUrl: book.cover_url,
      force: force,
      feedback: feedback,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }),
    };
  }
};

