import { BookGrid } from "@/components/book-grid";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { SupabaseSummary } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export default async function ReadPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="space-y-6 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-10 text-center">
        <h1 className="text-3xl font-semibold">Your read books</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Create an account or log in to see books you've marked as read.
        </p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();

  // Fetch books marked as read by the user
  const { data: readBooks, error } = await supabase
    .from("user_read_books")
    .select(`
      book_id,
      read_at,
      books(
        id, title, author, cover_url, file_url, summary, audio_urls, progress_percent, is_public, created_at
      )
    `)
    .eq("user_id", user.id)
    .order("read_at", { ascending: false });

  if (error) {
    console.error("Error fetching read books:", error);
    throw new Error("Failed to load your read books.");
  }

  const books = (readBooks ?? []).map(item => ({
    ...item.books,
    id: item.books.id,
    read_at: item.read_at,
  })) as (SupabaseSummary & { read_at: string })[];

  // Check which books are also favorited
  let favoriteBooks: Set<string> = new Set();
  if (books.length > 0) {
    const bookIds = books.map(book => book.id);
    const { data: favoriteData } = await supabase
      .from("user_favorites")
      .select("book_id")
      .eq("user_id", user.id)
      .in("book_id", bookIds);
    
    if (favoriteData) {
      favoriteBooks = new Set(favoriteData.map(item => item.book_id));
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
          Read Books
        </p>
        <h1 className="text-3xl font-semibold">Books you've read</h1>
        <p className="max-w-2xl text-sm text-[rgb(var(--muted-foreground))]">
          Books you've marked as read. You can remove them from this list or add them to favorites.
        </p>
      </header>

      {books.length ? (
        <BookGrid 
          books={books.map(book => ({
            ...book,
            isRead: true,
            isFavorited: favoriteBooks.has(book.id),
          }))}
          showLibraryActions={true}
          userRole="regular"
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--card))] p-12 text-center text-sm text-[rgb(var(--muted-foreground))]">
          No read books yet. Mark some books as read from your library to see them here.
        </div>
      )}
    </div>
  );
}
