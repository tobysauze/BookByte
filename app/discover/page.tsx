import { BookGrid } from "@/components/book-grid";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { SupabaseSummary } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { getUserRole } from "@/lib/user-roles";

export default async function DiscoverPage() {
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  const userRole = await getUserRole();

  // Fetch public books from all users
  const { data: books, error } = await supabase
    .from("books")
    .select(`
      id,
      title,
      author,
      cover_url,
      created_at,
      user_id,
      is_public,
      word_count,
      description,
      category
    `)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching public books:", error);
  }

  const publicBooks = (books ?? []) as SupabaseSummary[];

  // Check which books are saved to user's library (for regular users)
  let savedBookIds: string[] = [];
  if (user && userRole === "regular") {
    const { data: savedBooks } = await supabase
      .from("user_library")
      .select("book_id")
      .eq("user_id", user.id);

    savedBookIds = (savedBooks ?? []).map(item => item.book_id);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
          Community summaries
        </p>
        <h1 className="text-3xl font-semibold">Discover shared books</h1>
        <p className="max-w-2xl text-sm text-[rgb(var(--muted-foreground))]">
          Explore summaries shared by the BookByte community. Discover new books and insights from fellow readers.
        </p>
      </header>

      {publicBooks.length > 0 ? (
        <BookGrid
          books={publicBooks.map(book => ({
            ...book,
            isSavedToLibrary: savedBookIds.includes(book.id)
          }))}
          userRole={userRole}
          showDeleteButtons={userRole === "editor"}
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--card))] p-12 text-center text-sm text-[rgb(var(--muted-foreground))]">
          No public summaries yet. Be the first to share a book summary with the community!
        </div>
      )}
    </div>
  );
}

