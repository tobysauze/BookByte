import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
    try {
        const { supabase } = createSupabaseRouteHandlerClient(req);

        // Get the current user
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is an editor (admin)
        const { data: profile } = await supabase
            .from("user_profiles")
            .select("is_editor")
            .eq("id", user.id)
            .single();

        if (!profile?.is_editor) {
            return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
        }

        // Fetch all books that have a file (either file_url or local_file_path is not null)
        // Supabase JS doesn't support generic 'OR' across columns easily in one chain without 'or' filter string,
        // which can be messy. Simpler to just fetch all that have file_url OR local_file_path.
        // Using .or() filter: file_url.neq.null,local_file_path.neq.null
        const { data: books, error } = await supabase
            .from("books")
            .select("*, user_profiles(email)") // Join with user_profiles to get uploader email if possible, assuming user_profiles has email or we join auth.users (usually restricted).
            // Note: Joining auth.users directly is often not allowed due to permissions.
            // We'll try to get what we can. If 'user_profiles' stores email (it usually doesn't by default), we get it.
            // If not, we might only show User ID.
            .or('file_url.neq.null,local_file_path.neq.null')
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching admin files:", error);
            return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
        }

        return NextResponse.json({ books: books || [] });
    } catch (error) {
        console.error("Error in GET /api/admin/files:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { supabase } = createSupabaseRouteHandlerClient(req);
        const { searchParams } = new URL(req.url);
        const bookId = searchParams.get("id");

        if (!bookId) {
            return NextResponse.json({ error: "Missing book ID" }, { status: 400 });
        }

        // Get the current user
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check permissions
        const { data: profile } = await supabase
            .from("user_profiles")
            .select("is_editor")
            .eq("id", user.id)
            .single();

        if (!profile?.is_editor) {
            return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
        }

        // First fetch the book to get file paths for Storage deletion (if we implemented storage deletion)
        const { data: book, error: fetchError } = await supabase
            .from("books")
            .select("file_url, local_file_path")
            .eq("id", bookId)
            .single();

        if (fetchError || !book) {
            return NextResponse.json({ error: "Book not found" }, { status: 404 });
        }

        // TODO: If using Supabase Storage, delete the actual object from the bucket using book.file_url.
        // Since file_url structure varies, we extract the path.
        // For now, we mainly delete the record.

        // Delete the book record
        const { error: deleteError } = await supabase
            .from("books")
            .delete()
            .eq("id", bookId);

        if (deleteError) {
            console.error("Error deleting book:", deleteError);
            return NextResponse.json({ error: "Failed to delete book" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in DELETE /api/admin/files:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
