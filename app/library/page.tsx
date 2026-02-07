
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { getUserRole } from "@/lib/user-roles";
import { BookGrid } from "@/components/book-grid";
import { SearchInput } from "@/components/search-input";
import { CategoryFilter } from "@/components/category-filter";
import { SupabaseSummary } from "@/lib/supabase";

export default async function LibraryPage(props: { searchParams: Promise<{ query?: string; category?: string }> }) {
    const supabase = await createSupabaseServerClient();
    const user = await getSessionUser();
    const userRole = await getUserRole();
    const searchParams = await props.searchParams;

    if (!user) {
        redirect("/login");
    }

    // Get user's library items (saved books)
    const libraryQuery = supabase
        .from("user_library")
        .select(`
      book_id,
      books:book_id (
        id,
        title,
        author,
        cover_url,
        summary,
        progress_percent,
        word_count,
        description,
        category,
        is_public,
        created_at
      ),
      is_read,
      is_favorited,
      updated_at
    `)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

    // Get user's authored books
    const authoredQuery = supabase
        .from("books")
        .select(`
      id,
      title,
      author,
      cover_url,
      summary,
      progress_percent,
      word_count,
      description,
      category,
      is_public,
      created_at
    `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    const [libraryRes, authoredRes] = await Promise.all([libraryQuery, authoredQuery]);

    if (libraryRes.error) {
        console.error("Error fetching library:", libraryRes.error);
    }
    if (authoredRes.error) {
        console.error("Error fetching authored books:", authoredRes.error);
    }

    const libraryItems = libraryRes.data ?? [];
    const authoredBooks = authoredRes.data ?? [];

    // Filter and map items
    // Process library items
    const savedBooksMap = new Map();

    libraryItems.forEach((item: any) => {
        if (item.books) {
            savedBooksMap.set(item.books.id, {
                ...item.books,
                isRead: item.is_read,
                isFavorited: item.is_favorited,
                isSavedToLibrary: true,
                savedAt: item.updated_at
            });
        }
    });

    // Merge authored books
    // Authored books might not be in user_library, but valid for "My Library" view
    authoredBooks.forEach((book: any) => {
        if (!savedBooksMap.has(book.id)) {
            savedBooksMap.set(book.id, {
                ...book,
                isRead: false, // Default, or could fetch from user_read_books if needed
                isFavorited: false,
                isSavedToLibrary: false, // It's authored, not explicitly saved? Or treat as saved?
                // For now, let's treat authored books as part of library but maybe not "saved" via button
                // actually, for the grid, we want to show them.
                isAuthored: true
            });
        } else {
            // Updated existing entry to mark as authored
            const existing = savedBooksMap.get(book.id);
            savedBooksMap.set(book.id, { ...existing, isAuthored: true });
        }
    });

    // Convert map to array and sort
    let books = Array.from(savedBooksMap.values()) as (SupabaseSummary & {
        isRead: boolean;
        isFavorited: boolean;
        isSavedToLibrary: boolean;
        isAuthored?: boolean;
        savedAt?: string;
    })[];

    // Sort combined list by most recently interacted (saved or created)
    books.sort((a, b) => {
        const dateA = new Date(a.savedAt || a.created_at).getTime();
        const dateB = new Date(b.savedAt || b.created_at).getTime();
        return dateB - dateA;
    });

    // Apply filters in memory (since we're selecting across a join, it's often easier for simple filters)
    // Or better, we could filter in the query if we change the structure, but this works for now.

    if (searchParams?.query) {
        const query = searchParams.query.toLowerCase();
        books = books.filter(book =>
            book.title.toLowerCase().includes(query) ||
            (book.author && book.author.toLowerCase().includes(query))
        );
    }

    if (searchParams?.category && searchParams.category !== "all") {
        books = books.filter(book => book.category === searchParams.category);
    }

    return (
        <div className="space-y-8">
            <header className="space-y-4">
                <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
                        Your Collection
                    </p>
                    <h1 className="text-3xl font-semibold">My Library</h1>
                    <p className="max-w-2xl text-sm text-[rgb(var(--muted-foreground))]">
                        Manage your saved summaries, track your reading progress, and organize your favorites.
                    </p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row gap-4">
                    <SearchInput placeholder="Search your library..." />
                    <CategoryFilter />
                </div>
            </header>

            {books.length > 0 ? (
                <BookGrid
                    books={books}
                    userRole={userRole}
                    showDeleteButtons={false}
                    showLibraryActions={true}
                />
            ) : (
                <div className="rounded-3xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--card))] p-12 text-center text-sm text-[rgb(var(--muted-foreground))]">
                    {searchParams?.query || searchParams?.category ? "No books found matching your filters." : "Your library is empty. Save books from the Discover page to see them here!"}
                </div>
            )}
        </div>
    );
}
