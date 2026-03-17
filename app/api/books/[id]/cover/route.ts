import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUserRole } from "@/lib/user-roles";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRole();
    if (role !== "editor") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      );
    }

    const admin = getSupabaseAdminClient();

    const { error } = await admin
      .from("books")
      .update({ cover_url: null })
      .eq("id", id);

    if (error) {
      console.error("Error deleting cover:", error);
      return NextResponse.json(
        { error: "Failed to delete cover" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/books/[id]/cover:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
