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

    // Check if the book exists and is public
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, is_public")
      .eq("id", bookId)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (!book.is_public) {
      return NextResponse.json({ error: "This book is not available for saving" }, { status: 403 });
    }

    // Check if already saved to avoid duplicate
    const { data: existingEntry } = await supabase
      .from("user_library")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .single();

    if (existingEntry) {
      const alreadySavedResponse = NextResponse.json({ 
        success: true,
        message: "Book already in library" 
      }, { status: 200 });
      
      response.cookies.getAll().forEach((cookie) => {
        alreadySavedResponse.cookies.set(cookie);
      });
      
      return alreadySavedResponse;
    }

    // Add to user library
    const { error: insertError } = await supabase
      .from("user_library")
      .insert({
        user_id: user.id,
        book_id: bookId,
      });

    if (insertError) {
      console.error("Error saving to library:", insertError);
      // Check if it's a duplicate key error
      if (insertError.code === "23505" || insertError.message?.includes("duplicate")) {
        const duplicateResponse = NextResponse.json({ 
          success: true,
          message: "Book already in library" 
        }, { status: 200 });
        
        response.cookies.getAll().forEach((cookie) => {
          duplicateResponse.cookies.set(cookie);
        });
        
        return duplicateResponse;
      }
      return NextResponse.json({ 
        error: insertError.message || "Failed to save to library" 
      }, { status: 500 });
    }

    const successResponse = NextResponse.json({ 
      success: true,
      message: "Book saved to library" 
    }, { status: 200 });
    
    // Copy cookies from auth response
    response.cookies.getAll().forEach((cookie) => {
      successResponse.cookies.set(cookie);
    });
    
    return successResponse;
  } catch (error) {
    console.error("Error in /api/user-library/[bookId] POST:", error);
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

    // Remove from user library
    const { error: deleteError } = await supabase
      .from("user_library")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId);

    if (deleteError) {
      console.error("Error removing from library:", deleteError);
      return NextResponse.json({ error: "Failed to remove from library" }, { status: 500 });
    }

    const deleteResponse = NextResponse.json({ 
      success: true,
      message: "Book removed from library" 
    }, { status: 200 });
    
    // Copy cookies from auth response
    response.cookies.getAll().forEach((cookie) => {
      deleteResponse.cookies.set(cookie);
    });
    
    return deleteResponse;
  } catch (error) {
    console.error("Error in /api/user-library/[bookId] DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
