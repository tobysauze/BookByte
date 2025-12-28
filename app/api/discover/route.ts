import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { supabase, response } = createSupabaseRouteHandlerClient(req);

    // Fetch public books from all users
    const { data: books, error } = await supabase
      .from("books")
      .select(`
        id,
        title,
        author,
        cover_url,
        summary,
        created_at,
        user_id
      `)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(50); // Limit to 50 most recent public books

    if (error) {
      console.error("Error fetching public books:", error);
      return NextResponse.json({ error: "Failed to fetch books" }, { status: 500 });
    }

    return NextResponse.json({ books }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/discover:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}






