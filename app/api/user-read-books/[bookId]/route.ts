import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    console.log("API: Marking book as read:", bookId);
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
      return NextResponse.json({ error: "Cannot mark a private book as read." }, { status: 403 });
    }

    // Check if already marked as read
    const { data: existingEntry } = await supabase
      .from("user_read_books")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .single();

    if (existingEntry) {
      return NextResponse.json({ success: true, message: "Book already marked as read." }, { status: 200 });
    }

    // Mark as read
    const { error: insertError } = await supabase
      .from("user_read_books")
      .insert({ user_id: user.id, book_id: bookId });

    if (insertError) {
      console.error("Error marking book as read:", insertError);
      return NextResponse.json({ error: "Failed to mark book as read." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Book marked as read." }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/user-read-books/[bookId] (POST):", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
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
      .from("user_read_books")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId);

    if (deleteError) {
      console.error("Error removing book from read list:", deleteError);
      return NextResponse.json({ error: "Failed to remove book from read list." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Book removed from read list." }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/user-read-books/[bookId] (DELETE):", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
