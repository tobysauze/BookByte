import Link from "next/link";
import { Plus } from "lucide-react";

import { BookGrid } from "@/components/book-grid";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { SupabaseSummary } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { getUserRole } from "@/lib/user-roles";

export default async function LibraryPage() {
  const user = await getSessionUser();
  const userRole = await getUserRole();

  if (!user) {
    return (
      <div className="space-y-6 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-10 text-center">
        <h1 className="text-3xl font-semibold">Your library is waiting</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Create an account or log in to start saving book summaries, track your progress, and listen to audio recaps.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/discover">Browse Discover</Link>
          </Button>
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  let books: SupabaseSummary[] = [];
  let error: any = null;

  if (userRole === "editor") {
    // Editors see all their created books
    const { data, error: editorError } = await supabase
      .from("books")
      .select("id, title, author, cover_url, file_url, summary, audio_urls, progress_percent, is_public, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    books = (data ?? []) as SupabaseSummary[];
    error = editorError;
  } else {
    // Regular users see both:
    // 1. Books they created themselves
    // 2. Books they saved from other users
    const [ownBooksResult, savedBooksResult] = await Promise.all([
      // Get books they created
      supabase
        .from("books")
        .select("id, title, author, cover_url, file_url, summary, audio_urls, progress_percent, is_public, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      // Get books they saved from user_library
      supabase
        .from("user_library")
        .select(`
          book_id,
          books(
            id, title, author, cover_url, file_url, summary, audio_urls, progress_percent, is_public, created_at
          )
        `)
        .eq("user_id", user.id)
        .order("saved_at", { ascending: false })
    ]);

    const ownBooks = (ownBooksResult.data ?? []) as SupabaseSummary[];
    const savedBooks = (savedBooksResult.data ?? [])
      .filter(item => item.books !== null)
      .map(item => ({
        ...(item.books as unknown as SupabaseSummary),
        id: (item.books as unknown as SupabaseSummary).id,
      })) as SupabaseSummary[];

    // Combine both lists, removing duplicates (in case they saved their own book)
    const bookMap = new Map<string, SupabaseSummary>();
    
    // Add own books first
    ownBooks.forEach(book => {
      bookMap.set(book.id, book);
    });
    
    // Add saved books (won't overwrite if already exists)
    savedBooks.forEach(book => {
      if (!bookMap.has(book.id)) {
        bookMap.set(book.id, book);
      }
    });
    
    books = Array.from(bookMap.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    if (ownBooksResult.error) {
      error = ownBooksResult.error;
    } else if (savedBooksResult.error) {
      error = savedBooksResult.error;
    }
  }

  // For regular users, also fetch read and favorite status
  let readBooks: Set<string> = new Set();
  let favoriteBooks: Set<string> = new Set();
  
  if (userRole === "regular" && books.length > 0) {
    const bookIds = books.map(book => book.id);
    
    // Check which books are marked as read
    const { data: readData } = await supabase
      .from("user_read_books")
      .select("book_id")
      .eq("user_id", user.id)
      .in("book_id", bookIds);
    
    if (readData) {
      readBooks = new Set(readData.map(item => item.book_id));
    }
    
    // Check which books are favorited
    const { data: favoriteData } = await supabase
      .from("user_favorites")
      .select("book_id")
      .eq("user_id", user.id)
      .in("book_id", bookIds);
    
    if (favoriteData) {
      favoriteBooks = new Set(favoriteData.map(item => item.book_id));
    }
  }

  if (error) {
    console.error(error);
    throw new Error("Failed to load your saved books.");
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
              My Library
            </p>
            <h1 className="text-3xl font-semibold">
              {userRole === "editor" ? "My Books" : "My Library"}
            </h1>
            <p className="max-w-2xl text-sm text-[rgb(var(--muted-foreground))]">
              {userRole === "editor" 
                ? "Manage your book summaries, edit titles, upload covers, and control visibility."
                : "Your created summaries and books you've saved from the community."
              }
            </p>
          </div>
          <div className="flex gap-3 pt-8">
            {userRole === "editor" ? (
              <Button asChild>
                <Link href="/create-book" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Book
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Summary
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {books.length ? (
        <BookGrid 
          books={books.map(book => ({
            ...book,
            isRead: userRole === "regular" ? readBooks.has(book.id) : false,
            isFavorited: userRole === "regular" ? favoriteBooks.has(book.id) : false,
          }))}
          showDeleteButtons={userRole === "editor"}
          showLibraryActions={userRole === "regular"}
          userRole={userRole}
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--card))] p-12 text-center text-sm text-[rgb(var(--muted-foreground))]">
          {userRole === "editor" 
            ? "No books yet. Upload your first book from the home page to get started."
            : "No books yet. Create your first summary from the home page or browse the Discover page to find books to save."
          }
        </div>
      )}
    </div>
  );
}

