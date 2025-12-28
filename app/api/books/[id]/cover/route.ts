import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { sanitizeFilename } from "@/lib/utils";
import { canEditBookWithClient } from "@/lib/user-roles";

export async function POST(
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

    // Check if user can edit the book
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, user_id, is_public")
      .eq("id", id)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const canEdit = await canEditBookWithClient(supabase, book.user_id, book.is_public);
    if (!canEdit) {
      return NextResponse.json({ error: "Unauthorized to update this book" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("cover") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: "Invalid file type. Please upload a JPEG, PNG, or WebP image." 
      }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: "File too large. Please upload an image smaller than 5MB." 
      }, { status: 400 });
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `cover-${Date.now()}.${fileExtension}`;
    const storagePath = `${user.id}/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("book-files")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload cover image:", uploadError);
      return NextResponse.json({ error: "Failed to upload cover image" }, { status: 500 });
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("book-files").getPublicUrl(uploadData.path);

    // Update book record with cover URL
    const { error: updateError } = await supabase
      .from("books")
      .update({ cover_url: publicUrl })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update book cover:", updateError);
      return NextResponse.json({ error: "Failed to update book cover" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      coverUrl: publicUrl 
    }, { 
      status: 200,
      headers: response.headers 
    });
  } catch (error) {
    console.error("Error in /api/books/[id]/cover:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
