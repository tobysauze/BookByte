import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createSupabaseRouteHandlerClient(request);
    const applyCookies = (res: NextResponse) => {
      response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    };

    const user = await getSessionUser();
    if (!user) {
      return applyCookies(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    // Fetch books from the user's library + their authored books
    const [libraryRes, authoredRes] = await Promise.all([
      supabase
        .from("user_library")
        .select("books:book_id (id, title, author, cover_url, category)")
        .eq("user_id", user.id)
        .limit(200),
      supabase
        .from("books")
        .select("id, title, author, cover_url, category")
        .eq("user_id", user.id)
        .limit(200),
    ]);

    const seen = new Set<string>();
    const books: {
      id: string;
      title: string;
      author: string | null;
      cover_url: string | null;
      category: string | null;
    }[] = [];

    for (const item of libraryRes.data ?? []) {
      const b = item.books as unknown as {
        id: string;
        title: string;
        author: string | null;
        cover_url: string | null;
        category: string | null;
      } | null;
      if (b && !seen.has(b.id)) {
        seen.add(b.id);
        books.push(b);
      }
    }

    for (const b of authoredRes.data ?? []) {
      if (!seen.has(b.id)) {
        seen.add(b.id);
        books.push(b);
      }
    }

    books.sort((a, b) => a.title.localeCompare(b.title));

    return applyCookies(NextResponse.json({ books }));
  } catch (error) {
    console.error("Error in GET /api/user-library-books:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
