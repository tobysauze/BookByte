import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { isEditor } from "@/lib/user-roles";

export async function DELETE(req: NextRequest) {
  try {
    const { supabase, response } = createSupabaseRouteHandlerClient(req);
    const applyCookies = (res: NextResponse) => {
      response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    };

    const user = await getSessionUser();
    if (!user) {
      return applyCookies(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const body = await req.json();
    const bookIds: string[] = Array.isArray(body.bookIds) ? body.bookIds : [];

    if (bookIds.length === 0) {
      return applyCookies(
        NextResponse.json({ error: "No book IDs provided" }, { status: 400 })
      );
    }

    if (bookIds.length > 50) {
      return applyCookies(
        NextResponse.json(
          { error: "Cannot delete more than 50 books at once" },
          { status: 400 }
        )
      );
    }

    // Check permission (must be editor/admin to bulk delete)
    const editorAccess = await isEditor();
    if (!editorAccess) {
      return applyCookies(
        NextResponse.json(
          { error: "Only editors can bulk delete books" },
          { status: 403 }
        )
      );
    }

    // Fetch all books to get file URLs for cleanup
    const { data: books, error: fetchError } = await supabase
      .from("books")
      .select("id, file_url, cover_url")
      .in("id", bookIds);

    if (fetchError) {
      console.error("Error fetching books for bulk delete:", fetchError);
      return applyCookies(
        NextResponse.json({ error: "Failed to fetch books" }, { status: 500 })
      );
    }

    if (!books || books.length === 0) {
      return applyCookies(
        NextResponse.json({ error: "No books found" }, { status: 404 })
      );
    }

    // Delete associated files from storage
    for (const book of books) {
      const filesToDelete: string[] = [];

      if (book.file_url) {
        const filePath = book.file_url.split("/").slice(-2).join("/");
        filesToDelete.push(filePath);
      }
      if (book.cover_url) {
        const coverPath = book.cover_url.split("/").slice(-2).join("/");
        filesToDelete.push(coverPath);
      }

      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("book-files")
          .remove(filesToDelete);

        if (storageError) {
          console.error(
            `Failed to delete files for book ${book.id}:`,
            storageError
          );
        }
      }
    }

    // Delete all book records
    const foundIds = books.map((b) => b.id);
    const { error: deleteError } = await supabase
      .from("books")
      .delete()
      .in("id", foundIds);

    if (deleteError) {
      console.error("Error bulk deleting books:", deleteError);
      return applyCookies(
        NextResponse.json(
          { error: "Failed to delete books" },
          { status: 500 }
        )
      );
    }

    return applyCookies(
      NextResponse.json(
        {
          success: true,
          message: `${foundIds.length} book(s) deleted successfully`,
          deletedCount: foundIds.length,
        },
        { status: 200, headers: response.headers }
      )
    );
  } catch (error) {
    console.error("Error in /api/books/bulk-delete:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
