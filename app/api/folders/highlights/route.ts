import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { supabase, response } = createSupabaseRouteHandlerClient(request);
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { folderId, highlightId } = body;

    if (!folderId || !highlightId) {
      return NextResponse.json({ error: "Folder ID and Highlight ID are required" }, { status: 400 });
    }

    // Verify the folder belongs to the user
    const { data: folder } = await supabase
      .from("user_folders")
      .select("id")
      .eq("id", folderId)
      .eq("user_id", user.id)
      .single();

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Verify the highlight belongs to the user
    const { data: highlight } = await supabase
      .from("user_highlights")
      .select("id")
      .eq("id", highlightId)
      .eq("user_id", user.id)
      .single();

    if (!highlight) {
      return NextResponse.json({ error: "Highlight not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("folder_highlights")
      .insert({
        folder_id: folderId,
        highlight_id: highlightId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding highlight to folder:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Highlight already in folder" }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to add highlight to folder" }, { status: 500 });
    }

    return NextResponse.json({ success: true, folderHighlight: data }, { headers: response.headers });
  } catch (error) {
    console.error("Error in POST /api/folders/highlights:", error);
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
    const folderId = searchParams.get("folderId");
    const highlightId = searchParams.get("highlightId");

    if (!folderId || !highlightId) {
      return NextResponse.json({ error: "Folder ID and Highlight ID are required" }, { status: 400 });
    }

    // Verify the folder belongs to the user
    const { data: folder } = await supabase
      .from("user_folders")
      .select("id")
      .eq("id", folderId)
      .eq("user_id", user.id)
      .single();

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("folder_highlights")
      .delete()
      .eq("folder_id", folderId)
      .eq("highlight_id", highlightId);

    if (error) {
      console.error("Error removing highlight from folder:", error);
      return NextResponse.json({ error: "Failed to remove highlight from folder" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { headers: response.headers });
  } catch (error) {
    console.error("Error in DELETE /api/folders/highlights:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createSupabaseRouteHandlerClient(request);
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const folderId = searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    // Verify the folder belongs to the user and get highlights
    const { data: folderHighlights, error } = await supabase
      .from("folder_highlights")
      .select(`
        id,
        highlight_id,
        user_highlights:highlight_id (
          id,
          book_id,
          section,
          item_index,
          highlighted_text,
          color,
          created_at,
          books:book_id (
            id,
            title,
            author,
            cover_url
          )
        )
      `)
      .eq("folder_id", folderId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching folder highlights:", error);
      return NextResponse.json({ error: "Failed to fetch folder highlights" }, { status: 500 });
    }

    // Verify folder ownership
    const { data: folder } = await supabase
      .from("user_folders")
      .select("id, name, color")
      .eq("id", folderId)
      .eq("user_id", user.id)
      .single();

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Transform the data
    const highlights = (folderHighlights || [])
      .map((fh: any) => fh.user_highlights)
      .filter(Boolean);

    return NextResponse.json({ 
      folder,
      highlights 
    }, { headers: response.headers });
  } catch (error) {
    console.error("Error in GET /api/folders/highlights:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}






