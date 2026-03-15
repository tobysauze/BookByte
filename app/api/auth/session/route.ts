import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = (await request.json()) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: "Tokens are required" },
        { status: 400 },
      );
    }

    const { supabase, response: authResponse } =
      createSupabaseRouteHandlerClient(request);

    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const result = NextResponse.json({ success: true }, { status: 200 });
    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });

    return result;
  } catch (err) {
    console.error("Session sync error:", err);
    return NextResponse.json(
      { error: "Failed to sync session" },
      { status: 500 },
    );
  }
}
