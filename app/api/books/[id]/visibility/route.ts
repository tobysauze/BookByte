import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, response } = createSupabaseRouteHandlerClient(req);
    const { id: bookId } = await params;

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the request body
    const { is_public } = await req.json();

    if (typeof is_public !== "boolean") {
      return NextResponse.json({ error: "Invalid is_public value" }, { status: 400 });
    }

    // Update the book's visibility
    const { data, error } = await supabase
      .from("books")
      .update({ is_public })
      .eq("id", bookId)
      .eq("user_id", user.id) // Ensure user can only update their own books
      .select("id, is_public")
      .single();

    if (error) {
      console.error("Error updating book visibility:", error);
      return NextResponse.json({ error: "Failed to update book visibility" }, { status: 500 });
    }

    return NextResponse.json({ success: true, book: data }, { 
      status: 200,
      headers: response.headers 
    });
  } catch (error) {
    console.error("Error in /api/books/[id]/visibility:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
