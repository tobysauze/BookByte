import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const SUPABASE_URL = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

function buildCookieHeader(existing: Array<{ name: string; value: string }>) {
  // Request Cookie header only includes name=value pairs (no options).
  return existing.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * Keep Supabase auth session fresh across requests.
 *
 * Without this, the access token can expire and users will appear to "randomly"
 * get logged out (especially in production where server components rely on cookies).
 */
export async function proxy(request: NextRequest) {
  // We must forward refreshed cookies to Server Components in THIS request.
  // Doing so requires overriding the downstream request headers.
  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const cookieMap = new Map<string, string>();
  request.cookies.getAll().forEach((c) => cookieMap.set(c.name, c.value));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

