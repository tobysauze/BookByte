import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(req);
    
    // Get the current user from the Supabase client
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("Error getting user:", userError);
      const result = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }

    if (!user) {
      const result = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }

    // Ensure the book exists and is public
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("is_public")
      .eq("id", bookId)
      .single();

    if (bookError || !book) {
      const result = NextResponse.json({ error: "Book not found" }, { status: 404 });
      authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }

    if (!book.is_public) {
      const result = NextResponse.json({ error: "Cannot favorite a private book." }, { status: 403 });
      authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }

    // Check if already favorited
    const { data: existingEntry } = await supabase
      .from("user_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .single();

    if (existingEntry) {
      const result = NextResponse.json({ success: true, message: "Book already in favorites." }, { status: 200 });
      authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }

    // Add to favorites
    const { error: insertError } = await supabase
      .from("user_favorites")
      .insert({ user_id: user.id, book_id: bookId });

    if (insertError) {
      console.error("Error adding book to favorites:", insertError);
      const result = NextResponse.json({ error: "Failed to add book to favorites." }, { status: 500 });
      authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }

    const result = NextResponse.json({ success: true, message: "Book added to favorites." }, { status: 200 });
    authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  } catch (error) {
    console.error("Error in /api/user-favorites/[bookId] (POST):", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(req);
    
    // Get the current user from the Supabase client
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("Error getting user:", userError);
      const result = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }

    if (!user) {
      const result = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }

    const { error: deleteError } = await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId);

    if (deleteError) {
      console.error("Error removing book from favorites:", deleteError);
      const result = NextResponse.json({ error: "Failed to remove book from favorites." }, { status: 500 });
      authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }

    const result = NextResponse.json({ success: true, message: "Book removed from favorites." }, { status: 200 });
    authResponse.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  } catch (error) {
    console.error("Error in /api/user-favorites/[bookId] (DELETE):", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
