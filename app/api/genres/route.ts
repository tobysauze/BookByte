import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSessionUser } from "@/lib/auth";
import { isEditor } from "@/lib/user-roles";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createSupabaseRouteHandlerClient(request);
    const applyCookies = (res: NextResponse) => {
      response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    };

    const { data, error } = await supabase
      .from("genres")
      .select("id, name, parent_id, created_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching genres:", error);
      return applyCookies(
        NextResponse.json(
          { error: "Failed to fetch genres" },
          { status: 500 },
        ),
      );
    }

    return applyCookies(NextResponse.json({ genres: data || [] }));
  } catch (error) {
    console.error("Error in GET /api/genres:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const editorCheck = await isEditor();
    if (!editorCheck) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, parentId } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Genre name is required" },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("genres")
      .insert({ name: name.trim(), parent_id: parentId || null })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A genre with this name already exists" },
          { status: 409 },
        );
      }
      console.error("Error creating genre:", error);
      return NextResponse.json(
        { error: "Failed to create genre" },
        { status: 500 },
      );
    }

    return NextResponse.json({ genre: data });
  } catch (error) {
    console.error("Error in POST /api/genres:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const editorCheck = await isEditor();
    if (!editorCheck) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Genre ID is required" },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdminClient();
    const { error } = await admin.from("genres").delete().eq("id", id);

    if (error) {
      console.error("Error deleting genre:", error);
      return NextResponse.json(
        { error: "Failed to delete genre" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/genres:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
