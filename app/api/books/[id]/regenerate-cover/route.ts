import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { getUserRole } from "@/lib/user-roles";
import { z } from "zod";

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const regenerateCoverSchema = z.object({
  feedback: z.string().optional().nullable(),
});

/**
 * Admin-only endpoint to regenerate book cover images
 * Allows admins to force regeneration of covers with optional feedback/corrections
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, response } = createSupabaseRouteHandlerClient(req);
    const applyCookies = (res: NextResponse) => {
      response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    };

    const user = await getSessionUser();
    if (!user) {
      return applyCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    // Check if user is an editor/admin
    const role = await getUserRole();
    if (role !== "editor") {
      return applyCookies(
        NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { feedback } = regenerateCoverSchema.parse(body);

    // Fetch book details
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, user_id, title, author, description, category, cover_url")
      .eq("id", id)
      .single();

    if (bookError || !book) {
      return applyCookies(NextResponse.json({ error: "Book not found" }, { status: 404 }));
    }

    // Validate book has required fields
    if (!book.title?.trim()) {
      return applyCookies(
        NextResponse.json({ error: "Book title is required" }, { status: 400 })
      );
    }

    const authorTrimmed = (book.author || "").trim();
    if (!authorTrimmed) {
      return applyCookies(
        NextResponse.json({ error: "Book author is required for cover generation" }, { status: 400 })
      );
    }

    // Trigger background cover generation (async, won't timeout)
    try {
      const secret = getRequiredEnv("GOOGLE_DRIVE_IMPORT_SECRET");
      const origin = req.nextUrl.origin;
      
      // Fire and forget - trigger background function
      fetch(`${origin}/.netlify/functions/generate-cover-background`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-import-secret": secret,
        },
        body: JSON.stringify({
          bookId: book.id,
          force: true,
          feedback: feedback || null,
        }),
      }).catch((e) => {
        console.warn("Failed to trigger background cover generation:", e);
      });

      return applyCookies(
        NextResponse.json(
          {
            success: true,
            message: feedback
              ? "Cover regeneration started with your feedback. It will be ready shortly."
              : "Cover regeneration started. It will be ready shortly.",
          },
          { status: 202 } // Accepted - processing asynchronously
        )
      );
    } catch (error) {
      console.error("Error triggering cover regeneration:", error);
      return applyCookies(
        NextResponse.json(
          { error: error instanceof Error ? error.message : "Failed to start cover regeneration" },
          { status: 500 }
        )
      );
    }
  } catch (error) {
    console.error("Error in /api/books/[id]/regenerate-cover:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body", details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
