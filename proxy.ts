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

/**
 * Keep Supabase auth session fresh across requests.
 *
 * Without this, the access token can expire and users will appear to "randomly"
 * get logged out (especially in production where server components rely on cookies).
 */
export async function proxy(request: NextRequest) {
  // Create a response we can attach refreshed cookies to.
  // Also keep the request cookies in sync so Server Components don't attempt
  // to refresh the same session again within this request.
  const response = NextResponse.next({ request });

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

