import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { getUserRole } from "@/lib/user-roles";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
      return applyCookies(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    const role = await getUserRole();
    if (role !== "editor") {
      return applyCookies(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      );
    }

    const { error } = await supabase
      .from("books")
      .update({ cover_url: null })
      .eq("id", id);

    if (error) {
      console.error("Error deleting cover:", error);
      return applyCookies(
        NextResponse.json({ error: "Failed to remove cover" }, { status: 500 }),
      );
    }

    return applyCookies(NextResponse.json({ success: true }));
  } catch (err) {
    console.error("Error in DELETE /api/books/[id]/cover:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
