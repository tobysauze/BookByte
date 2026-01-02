import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/library";

  if (code) {
    // Create client that can set cookies on the 'response' object
    const { supabase, response } = createSupabaseRouteHandlerClient(request);

    // Exchange code for session. This updates the 'response' cookies.
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Create the redirect response
      const redirectResponse = NextResponse.redirect(`${origin}${next}`);

      // Copy the cookies from our temporary 'response' to the actual redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });

      return redirectResponse;
    } else {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=No+code+provided`);
}
