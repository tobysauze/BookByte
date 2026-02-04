import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { canEditBookWithClient } from "@/lib/user-roles";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log("Title update request for book ID:", id);
    
    const { supabase, response } = createSupabaseRouteHandlerClient(req);
    const applyCookies = (res: NextResponse) => {
      response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    };
    
    // Try to get user from the supabase client directly
    const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser();
    console.log("Supabase user check:", { user: supabaseUser?.id, error: userError });
    
    const user = await getSessionUser();
    console.log("Session user:", user?.id);

    if (!user && !supabaseUser) {
      console.log("No user found in title update request");
      return applyCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    const currentUser = user || supabaseUser;
    console.log("Using user ID:", currentUser?.id);

    // Get the book to check ownership and permissions
    const { data: book, error: fetchError } = await supabase
      .from("books")
      .select("id, user_id, title, is_public")
      .eq("id", id)
      .single();

    if (fetchError || !book) {
      console.error("Error fetching book:", fetchError);
      return applyCookies(NextResponse.json({ error: "Book not found" }, { status: 404 }));
    }

    console.log("Book found:", { id: book.id, user_id: book.user_id, is_public: book.is_public });

    // Check if user can edit this book
    try {
      const canEdit = await canEditBookWithClient(supabase, book.user_id, book.is_public);
      if (!canEdit) {
        return applyCookies(
          NextResponse.json(
            { error: "You don't have permission to edit this book" },
            { status: 403 },
          ),
        );
      }
    } catch (permissionError) {
      console.error("Error checking edit permissions:", permissionError);
      return applyCookies(NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 }));
    }

    // Parse the request body
    let title: string;
    try {
      const body = await req.json();
      title = body.title;
      console.log("Received title:", title);
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return applyCookies(NextResponse.json({ error: "Invalid request body" }, { status: 400 }));
    }

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return applyCookies(NextResponse.json({ error: "Title is required" }, { status: 400 }));
    }

    if (title.trim().length > 200) {
      return applyCookies(
        NextResponse.json({ error: "Title must be less than 200 characters" }, { status: 400 }),
      );
    }

    // Update the book title
    console.log("Updating book title in database...");
    const { error: updateError } = await supabase
      .from("books")
      .update({ title: title.trim() })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating book title:", updateError);
      return applyCookies(NextResponse.json({ error: "Failed to update book title" }, { status: 500 }));
    }

    console.log("Book title updated successfully");

    return applyCookies(NextResponse.json({ 
      success: true,
      title: title.trim(),
      message: "Title updated successfully" 
    }, { 
      status: 200,
      headers: response.headers 
    }));
  } catch (error) {
    console.error("Error in /api/books/[id]/title:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
