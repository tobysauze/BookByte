import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { canDeleteBookWithClient } from "@/lib/user-roles";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, response } = createSupabaseRouteHandlerClient(req);
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First, get the book to check permissions and get file URLs
    const { data: book, error: fetchError } = await supabase
      .from("books")
      .select("id, user_id, file_url, cover_url")
      .eq("id", id)
      .single();

    if (fetchError || !book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const canDelete = await canDeleteBookWithClient(supabase, book.user_id);
    if (!canDelete) {
      return NextResponse.json({ error: "Unauthorized to delete this book" }, { status: 403 });
    }

    // Delete associated files from storage
    const filesToDelete = [];
    
    if (book.file_url) {
      // Extract file path from URL
      const filePath = book.file_url.split('/').slice(-2).join('/'); // Get user_id/filename
      filesToDelete.push({ bucket: 'book-files', path: filePath });
    }

    if (book.cover_url) {
      // Extract cover path from URL
      const coverPath = book.cover_url.split('/').slice(-2).join('/'); // Get user_id/filename
      filesToDelete.push({ bucket: 'book-files', path: coverPath });
    }

    // Delete files from storage
    for (const file of filesToDelete) {
      const { error: storageError } = await supabase.storage
        .from(file.bucket)
        .remove([file.path]);
      
      if (storageError) {
        console.error(`Failed to delete file ${file.path}:`, storageError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete the book record from database
    const { error: deleteError } = await supabase
      .from("books")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting book:", deleteError);
      return NextResponse.json({ error: "Failed to delete book" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: "Book deleted successfully" 
    }, { 
      status: 200,
      headers: response.headers 
    });
  } catch (error) {
    console.error("Error in /api/books/[id]/delete:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
