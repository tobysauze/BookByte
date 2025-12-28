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

    const { data, error } = await supabase
      .from("user_folders")
      .select(`
        *,
        folder_highlights(count)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching folders:", error);
      return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
    }

    // Get highlight counts for each folder
    const foldersWithCounts = await Promise.all(
      (data || []).map(async (folder) => {
        const { count } = await supabase
          .from("folder_highlights")
          .select("*", { count: "exact", head: true })
          .eq("folder_id", folder.id);

        return {
          ...folder,
          highlight_count: count || 0,
        };
      })
    );

    return NextResponse.json({ folders: foldersWithCounts }, { headers: response.headers });
  } catch (error) {
    console.error("Error in GET /api/folders:", error);
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
    const { name, color } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("user_folders")
      .insert({
        user_id: user.id,
        name: name.trim(),
        color: color || "blue",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating folder:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "A folder with this name already exists" }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
    }

    return NextResponse.json({ folder: { ...data, highlight_count: 0 } }, { headers: response.headers });
  } catch (error) {
    console.error("Error in POST /api/folders:", error);
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
    const { id, name, color } = body;

    if (!id) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    const updateData: { name?: string; color?: string } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;

    const { data, error } = await supabase
      .from("user_folders")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating folder:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "A folder with this name already exists" }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
    }

    return NextResponse.json({ folder: data }, { headers: response.headers });
  } catch (error) {
    console.error("Error in PUT /api/folders:", error);
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
    const folderId = searchParams.get("id");

    if (!folderId) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_folders")
      .delete()
      .eq("id", folderId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting folder:", error);
      return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { headers: response.headers });
  } catch (error) {
    console.error("Error in DELETE /api/folders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

