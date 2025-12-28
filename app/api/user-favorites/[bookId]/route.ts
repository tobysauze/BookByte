import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const { supabase, response } = createSupabaseRouteHandlerClient(req);
    
    // Get the current user from the Supabase client
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("Error getting user:", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure the book exists and is public
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("is_public")
      .eq("id", bookId)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (!book.is_public) {
      return NextResponse.json({ error: "Cannot favorite a private book." }, { status: 403 });
    }

    // Check if already favorited
    const { data: existingEntry } = await supabase
      .from("user_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .single();

    if (existingEntry) {
      return NextResponse.json({ success: true, message: "Book already in favorites." }, { status: 200 });
    }

    // Add to favorites
    const { error: insertError } = await supabase
      .from("user_favorites")
      .insert({ user_id: user.id, book_id: bookId });

    if (insertError) {
      console.error("Error adding book to favorites:", insertError);
      return NextResponse.json({ error: "Failed to add book to favorites." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Book added to favorites." }, { status: 200 });
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
    const { supabase, response } = createSupabaseRouteHandlerClient(req);
    
    // Get the current user from the Supabase client
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("Error getting user:", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error: deleteError } = await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId);

    if (deleteError) {
      console.error("Error removing book from favorites:", deleteError);
      return NextResponse.json({ error: "Failed to remove book from favorites." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Book removed from favorites." }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/user-favorites/[bookId] (DELETE):", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
