import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { getUserRole } from "@/lib/user-roles";
import { maybeGenerateAndSaveCover } from "@/lib/cover-generator";
import { z } from "zod";

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

    // Generate new cover (force regeneration even if cover already exists)
    let result;
    try {
      result = await maybeGenerateAndSaveCover({
        bookId: book.id,
        userId: book.user_id,
        title: book.title,
        author: book.author,
        description: book.description,
        category: book.category,
        existingCoverUrl: book.cover_url,
        force: true, // Force regeneration
        feedback: feedback || null,
      });
    } catch (generateError) {
      console.error("Cover generation error:", generateError);
      const errorMessage = generateError instanceof Error ? generateError.message : "Unknown error during cover generation";
      return applyCookies(
        NextResponse.json(
          { error: `Cover generation failed: ${errorMessage}` },
          { status: 500 }
        )
      );
    }

    if (result.skipped) {
      return applyCookies(
        NextResponse.json(
          { error: "Cover generation skipped (missing title, author, or OpenAI API key not configured)" },
          { status: 400 }
        )
      );
    }

    if (!result.coverUrl) {
      return applyCookies(
        NextResponse.json({ error: "Failed to generate cover: No cover URL returned" }, { status: 500 })
      );
    }

    return applyCookies(
      NextResponse.json(
        {
          success: true,
          coverUrl: result.coverUrl,
          message: feedback
            ? "Cover regenerated with your feedback applied"
            : "Cover regenerated successfully",
        },
        { status: 200 }
      )
    );
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
