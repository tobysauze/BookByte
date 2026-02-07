import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    await supabase.auth.signOut();

    const result = NextResponse.json({ success: true }, { status: 200 });
    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });
    return result;
  } catch (error) {
    console.error("Logout error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Logout failed" },
      { status: 500 },
    );
  }
}

