import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createSupabaseRouteHandlerClient(request);
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get("bookId");

    let query = supabase
      .from("user_highlights")
      .select("*, books(id, title, author, cover_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (bookId) {
      query = query.eq("book_id", bookId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching highlights:", error);
      return NextResponse.json({ error: "Failed to fetch highlights" }, { status: 500 });
    }

    return NextResponse.json({ highlights: data || [] }, { headers: response.headers });
  } catch (error) {
    console.error("Error in GET /api/highlights:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, response } = createSupabaseRouteHandlerClient(request);
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bookId, section, itemIndex, highlightedText, contextText, startOffset, endOffset, color } = body;

    if (!bookId || !section || highlightedText === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("user_highlights")
      .insert({
        user_id: user.id,
        book_id: bookId,
        section: section,
        item_index: itemIndex ?? 0,
        highlighted_text: highlightedText,
        context_text: contextText,
        start_offset: startOffset,
        end_offset: endOffset,
        color: color || "yellow",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating highlight:", error);
      return NextResponse.json({ error: "Failed to create highlight" }, { status: 500 });
    }

    return NextResponse.json({ highlight: data }, { headers: response.headers });
  } catch (error) {
    console.error("Error in POST /api/highlights:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, response } = createSupabaseRouteHandlerClient(request);
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const highlightId = searchParams.get("id");

    if (!highlightId) {
      return NextResponse.json({ error: "Missing highlight ID" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_highlights")
      .delete()
      .eq("id", highlightId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting highlight:", error);
      return NextResponse.json({ error: "Failed to delete highlight" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { headers: response.headers });
  } catch (error) {
    console.error("Error in DELETE /api/highlights:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, response } = createSupabaseRouteHandlerClient(request);
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, color } = body;

    if (!id || !color) {
      return NextResponse.json({ error: "Missing highlight ID or color" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("user_highlights")
      .update({ color })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating highlight color:", error);
      return NextResponse.json({ error: "Failed to update highlight color" }, { status: 500 });
    }

    return NextResponse.json({ highlight: data }, { headers: response.headers });
  } catch (error) {
    console.error("Error in PUT /api/highlights:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

