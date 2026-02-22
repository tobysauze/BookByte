import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await params;
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(req);
    const applyCookies = (res: NextResponse) => {
      authResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
      return res;
    };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return applyCookies(NextResponse.json({ position: null }, { status: 200 }));

    const { data } = await supabase
      .from("reading_positions")
      .select("position, updated_at")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .maybeSingle();

    return applyCookies(
      NextResponse.json({
        position: data?.position ?? null,
        updatedAt: data?.updated_at ?? null,
      }),
    );
  } catch (error) {
    console.error("GET /api/reading-position error:", error);
    return NextResponse.json({ position: null }, { status: 200 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await params;
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(req);
    const applyCookies = (res: NextResponse) => {
      authResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
      return res;
    };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return applyCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));

    const body = await req.json();
    const position = body?.position;
    if (!position || typeof position !== "object") {
      return applyCookies(NextResponse.json({ error: "Invalid position" }, { status: 400 }));
    }

    const { error } = await supabase.from("reading_positions").upsert(
      {
        user_id: user.id,
        book_id: bookId,
        position,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,book_id" },
    );

    if (error) {
      console.error("PUT /api/reading-position upsert error:", error);
      return applyCookies(NextResponse.json({ error: "Failed to save" }, { status: 500 }));
    }

    return applyCookies(NextResponse.json({ success: true }));
  } catch (error) {
    console.error("PUT /api/reading-position error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
