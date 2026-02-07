
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

    // Get user's library items
    let queryBuilder = supabase
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

    const { data: libraryItems, error } = await queryBuilder;

    if (error) {
        console.error("Error fetching library:", error);
    }

    // Filter and map items
    let books = (libraryItems ?? [])
        .map((item: any) => ({
            ...item.books,
            isRead: item.is_read,
            isFavorited: item.is_favorited,
            isSavedToLibrary: true
        }))
        .filter((book: any) => book !== null) as (SupabaseSummary & { isRead: boolean; isFavorited: boolean; isSavedToLibrary: boolean })[];

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
