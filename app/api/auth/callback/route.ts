import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, session } = body as {
      event?: string;
      session?: Parameters<
        ReturnType<typeof createSupabaseRouteHandlerClient>["supabase"]["auth"]["setSession"]
      >[0];
    };

    const { supabase, response } = createSupabaseRouteHandlerClient(request);

    if (event === "SIGNED_OUT") {
      await supabase.auth.signOut();
    } else if (session) {
      await supabase.auth.setSession(session);
    }

    const result = NextResponse.json({ success: true });
    response.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });

    return result;
  } catch (error) {
    console.error("Auth callback error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auth callback failed" },
      { status: 500 },
    );
  }
}

