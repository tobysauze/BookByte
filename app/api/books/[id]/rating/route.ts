import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to rate summaries." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { rating, notes } = body;

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 10) {
      return NextResponse.json(
        { error: "Rating must be a number between 1 and 10." },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS policies (we've already verified auth above)
    const admin = getSupabaseAdminClient();

    // Upsert the rating (insert or update if exists)
    const { data, error } = await admin
      .from("summary_ratings")
      .upsert(
        {
          user_id: user.id,
          book_id: id,
          rating,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,book_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error saving rating:", error);
      return NextResponse.json(
        { error: "Failed to save rating." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ success: true, rating: data });
    authResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  } catch (error) {
    console.error("Error in POST /api/books/[id]/rating:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to view ratings." },
        { status: 401 }
      );
    }

    // Use admin client to bypass RLS policies
    const admin = getSupabaseAdminClient();

    // Get the current user's rating for this book
    const { data, error } = await admin
      .from("summary_ratings")
      .select("id, rating, notes, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("book_id", id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" which is fine
      console.error("Error fetching rating:", error);
      return NextResponse.json(
        { error: "Failed to fetch rating." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ rating: data || null });
    authResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  } catch (error) {
    console.error("Error in GET /api/books/[id]/rating:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
