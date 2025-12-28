import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { summarySchema, type SummaryPayload } from "@/lib/schemas";
import { getUserRole } from "@/lib/user-roles";

export const runtime = "nodejs";

/**
 * Create a blank book that editors can fill in manually
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to create books." },
        { status: 401 },
      );
    }

    // Check if user is an editor
    const userRole = await getUserRole();
    if (userRole !== "editor") {
      return NextResponse.json(
        { error: "Only editors can create blank books." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { title, author } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 },
      );
    }

    // Create a minimal blank summary that meets schema requirements
    const blankSummary: SummaryPayload = {
      short_summary: "A comprehensive summary of this book will be added here.",
      quick_summary: "This book summary is currently being created. Check back soon for the full summary.",
      key_ideas: [
        {
          title: "Key Idea 1",
          text: "Add your first key idea here.",
        },
        {
          title: "Key Idea 2",
          text: "Add your second key idea here.",
        },
        {
          title: "Key Idea 3",
          text: "Add your third key idea here.",
        },
      ],
      chapters: [
        {
          title: "Introduction",
          summary: "Add the introduction chapter summary here.",
        },
      ],
      actionable_insights: [
        "Add your first actionable insight here.",
        "Add your second actionable insight here.",
        "Add your third actionable insight here.",
      ],
      quotes: [
        "Add your first quote here.",
        "Add your second quote here.",
        "Add your third quote here.",
      ],
    };

    // Validate the summary structure
    const validationResult = summarySchema.safeParse(blankSummary);
    if (!validationResult.success) {
      console.error("Blank summary validation failed:", validationResult.error);
      return NextResponse.json(
        { error: "Failed to create blank summary structure." },
        { status: 500 },
      );
    }

    // Check if user is an editor (double check)
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("is_editor")
      .eq("id", user.id)
      .single();

    const isEditor = userProfile?.is_editor ?? false;

    const { data, error } = await supabase
      .from("books")
      .insert({
        user_id: user.id,
        title: title.trim(),
        author: author?.trim() || null,
        summary: validationResult.data,
        file_url: null,
        local_file_path: null,
        audio_urls: {},
        progress_percent: 0,
        is_public: false, // Start as private, editors can make public later
        is_editor_created: true,
      })
      .select("id, title, author")
      .single();

    if (error) {
      console.error("Error creating blank book:", error);
      return NextResponse.json(
        { error: "Failed to create blank book." },
        { status: 500 },
      );
    }

    const result = NextResponse.json({
      bookId: data.id,
      title: data.title,
      author: data.author,
    });

    // Merge auth cookies into response
    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });

    return result;
  } catch (error) {
    console.error("Error in create-blank route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}






