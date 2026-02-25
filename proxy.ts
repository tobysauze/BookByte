import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function buildCookieHeader(existing: Array<{ name: string; value: string }>) {
  return existing.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * Keep Supabase auth session fresh across requests.
 *
 * Without this, the access token can expire and users will appear to "randomly"
 * get logged out (especially in production where server components rely on cookies).
 */
export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const cookieMap = new Map<string, string>();
  request.cookies.getAll().forEach((c) => cookieMap.set(c.name, c.value));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Keep request cookies in sync for the remainder of this request.
          try {
            request.cookies.set({ name, value, ...options });
          } catch {
            // Some runtimes may not allow mutating request cookies.
          }

          // Also update the downstream request Cookie header so Server Components
          // see the refreshed session immediately.
          cookieMap.set(name, value);
          requestHeaders.set(
            "cookie",
            buildCookieHeader(Array.from(cookieMap, ([n, v]) => ({ name: n, value: v }))),
          );

          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  // Validate + refresh tokens when needed.
  // Supabase recommends getClaims() for SSR protection and refresh.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and common static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

