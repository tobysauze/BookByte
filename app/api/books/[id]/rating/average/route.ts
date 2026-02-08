import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = getSupabaseAdminClient();

    // Get all ratings for this book
    const { data, error } = await admin
      .from("summary_ratings")
      .select("rating")
      .eq("book_id", id);

    if (error) {
      console.error("Error fetching average rating:", error);
      return NextResponse.json(
        { error: "Failed to fetch average rating." },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        average: null,
        count: 0,
      });
    }

    const sum = data.reduce((acc, r) => acc + r.rating, 0);
    const average = Math.round((sum / data.length) * 10) / 10; // 1 decimal place

    return NextResponse.json({
      average,
      count: data.length,
    });
  } catch (error) {
    console.error("Error in GET /api/books/[id]/rating/average:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
