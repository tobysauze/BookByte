import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(req);

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's books
    const { data: books, error } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching user books:", error);
      const result = NextResponse.json({ error: "Failed to fetch books" }, { status: 500 });
      authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }

    const result = NextResponse.json({ books }, { status: 200 });
    authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  } catch (error) {
    console.error("Error in /api/books:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}






