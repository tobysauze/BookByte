import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { canEditBook } from "@/lib/user-roles";

export const runtime = "nodejs";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { section, data } = await request.json();

    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to edit summaries." },
        { status: 401 },
      );
    }

    // Get the book details
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .single();

    if (bookError || !book) {
      return NextResponse.json(
        { error: "Book not found." },
        { status: 404 },
      );
    }

    // Check if user can edit this book
    const canEdit = await canEditBook(book.user_id, book.is_public);
    if (!canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to edit this book." },
        { status: 403 },
      );
    }

    // Update the specific section in the summary
    const currentSummary = book.summary || {};
    let updatedSummary = { ...currentSummary };

    if (section === "full") {
      // Full summary update (for approved enhancements)
      updatedSummary = data;
    } else {
      // Single section update
      switch (section) {
        case "quick_summary":
          updatedSummary.quick_summary = data;
          break;
        case "short_summary":
          updatedSummary.short_summary = data;
          break;
        case "key_ideas":
          updatedSummary.key_ideas = data;
          break;
        case "chapters":
          updatedSummary.chapters = data;
          break;
        case "actionable_insights":
          updatedSummary.actionable_insights = data;
          break;
        case "quotes":
          updatedSummary.quotes = data;
          break;
        default:
          return NextResponse.json(
            { error: "Invalid section specified." },
            { status: 400 },
          );
      }
    }

    // Update the book in the database
    const { error: updateError } = await supabase
      .from("books")
      .update({
        summary: updatedSummary,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating book summary:", updateError);
      return NextResponse.json(
        { error: "Failed to update summary." },
        { status: 500 },
      );
    }

    const result = NextResponse.json({
      success: true,
      message: "Summary updated successfully",
    });

    // Merge auth cookies into response
    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });

    return result;
  } catch (error) {
    console.error("Summary update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    );
  }
}

