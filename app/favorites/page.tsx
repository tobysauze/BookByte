import { BookGrid } from "@/components/book-grid";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { SupabaseSummary } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export default async function FavoritesPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="space-y-6 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-10 text-center">
        <h1 className="text-3xl font-semibold">Your favorite books</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Create an account or log in to see books you've favorited.
        </p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();

  // Fetch books favorited by the user
  const { data: favoriteBooks, error } = await supabase
    .from("user_favorites")
    .select(`
      book_id,
      favorited_at,
      books(
        id, title, author, cover_url, file_url, summary, audio_urls, progress_percent, is_public, created_at
      )
    `)
    .eq("user_id", user.id)
    .order("favorited_at", { ascending: false });

  if (error) {
    console.error("Error fetching favorite books:", error);
    throw new Error("Failed to load your favorite books.");
  }

  const books = (favoriteBooks ?? [])
    .filter(item => item.books !== null)
    .map(item => ({
      ...(item.books as unknown as SupabaseSummary),
      favorited_at: item.favorited_at,
    })) as (SupabaseSummary & { favorited_at: string })[];

  // Check which books are also marked as read
  let readBooks: Set<string> = new Set();
  if (books.length > 0) {
    const bookIds = books.map(book => book.id);
    const { data: readData } = await supabase
      .from("user_read_books")
      .select("book_id")
      .eq("user_id", user.id)
      .in("book_id", bookIds);
    
    if (readData) {
      readBooks = new Set(readData.map(item => item.book_id));
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
          Favorite Books
        </p>
        <h1 className="text-3xl font-semibold">Books you love</h1>
        <p className="max-w-2xl text-sm text-[rgb(var(--muted-foreground))]">
          Books you've added to your favorites. You can remove them from this list or mark them as read.
        </p>
      </header>

      {books.length ? (
        <BookGrid 
          books={books.map(book => ({
            ...book,
            isRead: readBooks.has(book.id),
            isFavorited: true,
          }))}
          showLibraryActions={true}
          userRole="regular"
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--card))] p-12 text-center text-sm text-[rgb(var(--muted-foreground))]">
          No favorite books yet. Add some books to your favorites to see them here.
        </div>
      )}
    </div>
  );
}
