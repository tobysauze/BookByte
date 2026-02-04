import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getUserRole } from "@/lib/user-roles";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const role = user ? await getUserRole() : null;

    const result = NextResponse.json(
      {
        user: user ? { id: user.id, email: user.email } : null,
        role,
      },
      { status: 200 },
    );

    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });

    return result;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

