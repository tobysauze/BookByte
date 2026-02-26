import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookSummaryClient } from "@/components/book-summary-client";
import { BookHeroClient } from "@/components/book-hero-client";
import { BookAnalysis } from "@/components/book-analysis";
import { EnhanceSummaryButton } from "@/components/enhance-summary-button";
import { SummaryRating } from "@/components/summary-rating";
import { AverageRatingBadge } from "@/components/average-rating-badge";
import { BookJsonLd } from "@/components/book-json-ld";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { SupabaseSummary } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { getUserRole, canEditBook, canDeleteBook } from "@/lib/user-roles";

type BookPageParams = {
  params: Promise<{ id: string }>;
};

async function getBook(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("books")
    .select(
      "id, title, author, cover_url, file_url, summary, audio_urls, progress_percent, is_public, user_id, created_at, local_file_path, analysis_results, last_analyzed_at, word_count, description, category",
    )
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as SupabaseSummary;
}

function getBookDescription(book: SupabaseSummary): string {
  if (book.description) return book.description.slice(0, 200);
  const s = book.summary as Record<string, unknown> | null;
  if (s && typeof s === "object") {
    if (typeof s.short_summary === "string") return s.short_summary;
    if (typeof s.quick_summary === "string") return (s.quick_summary as string).slice(0, 200);
  }
  const byLine = book.author ? ` by ${book.author}` : "";
  return `AI-generated summary of "${book.title}"${byLine}. Key ideas, chapter breakdowns, and actionable insights.`;
}

export async function generateMetadata({ params }: BookPageParams): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return { title: "Book not found" };

  const description = getBookDescription(book);
  const byLine = book.author ? ` by ${book.author}` : "";
  const pageTitle = `${book.title}${byLine} — Summary`;

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      type: "article",
      url: `/books/${id}`,
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
    },
    alternates: {
      canonical: `/books/${id}`,
    },
  };
}

export default async function BookDetailPage({ params }: BookPageParams) {
  const { id } = await params;
  const book = await getBook(id);

  if (!book) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  const userRole = await getUserRole();

  const typedBook = book;

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
      <BookJsonLd book={typedBook} />
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

      {/* Average Rating Badge - visible to everyone at the top */}
      {typedBook.summary && (
        <AverageRatingBadge bookId={typedBook.id} />
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
          initialResults={typedBook.analysis_results as any}
        />
      )}

      {/* Summary Rating - at the bottom, after all content */}
      {user && typedBook.summary && (
        <div className="max-w-2xl mx-auto">
          <SummaryRating bookId={typedBook.id} />
        </div>
      )}
    </div>
  );
}

