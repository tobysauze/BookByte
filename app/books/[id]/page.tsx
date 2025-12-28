import { notFound } from "next/navigation";

import { BookSummaryClient } from "@/components/book-summary-client";
import { BookHeroClient } from "@/components/book-hero-client";
import { BookAnalysis } from "@/components/book-analysis";
import { EnhanceSummaryButton } from "@/components/enhance-summary-button";
import { SummaryRating } from "@/components/summary-rating";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { SupabaseSummary } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { getUserRole, canEditBook, canDeleteBook } from "@/lib/user-roles";

type BookPageParams = {
  params: { id: string };
};

export default async function BookDetailPage({ params }: BookPageParams) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  const userRole = await getUserRole();

  const { data: book, error } = await supabase
    .from("books")
    .select(
      "id, title, author, cover_url, file_url, summary, audio_urls, progress_percent, is_public, user_id, created_at, local_file_path, analysis_results, last_analyzed_at",
    )
    .eq("id", id)
    .single();

  if (error || !book) {
    console.error("Supabase error loading book", error);
    notFound();
  }

  const typedBook = book as SupabaseSummary;
  const isOwner = user?.id === typedBook.user_id;
  const canEdit = await canEditBook(typedBook.user_id, typedBook.is_public);
  const canDelete = await canDeleteBook(typedBook.user_id);

  // Check if user has saved this book to their library
  let isSavedToLibrary = false;
  let isRead = false;
  let isFavorited = false;
  
  if (user && userRole === "regular") {
    // Check if saved to library
    const { data: savedBook } = await supabase
      .from("user_library")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", id)
      .single();
    isSavedToLibrary = !!savedBook;

    // Check if marked as read
    const { data: readBook } = await supabase
      .from("user_read_books")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", id)
      .single();
    isRead = !!readBook;

    // Check if favorited
    const { data: favoriteBook } = await supabase
      .from("user_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", id)
      .single();
    isFavorited = !!favoriteBook;
  }

  return (
    <div className="space-y-10">
      <BookHeroClient 
        book={typedBook} 
        isOwner={isOwner}
        canEdit={canEdit}
        canDelete={canDelete}
        userRole={userRole}
        initialIsSavedToLibrary={isSavedToLibrary}
        initialIsRead={isRead}
        initialIsFavorited={isFavorited}
      />
      
      {/* Summary Rating - Only for editors, at the top */}
      {userRole === "editor" && (
        <div className="max-w-2xl mx-auto">
          <SummaryRating bookId={typedBook.id} />
        </div>
      )}
      
      <BookSummaryClient book={typedBook} canEdit={canEdit} />
      
      {/* Enhance Summary Button */}
      {canEdit && typedBook.local_file_path && (
        <div className="flex justify-center">
          <EnhanceSummaryButton bookId={typedBook.id} canEdit={canEdit} />
        </div>
      )}
      
      {/* Show analysis component only for book owners */}
      {isOwner && typedBook.local_file_path && (
        <BookAnalysis 
          bookId={typedBook.id} 
          initialResults={typedBook.analysis_results}
        />
      )}
    </div>
  );
}

