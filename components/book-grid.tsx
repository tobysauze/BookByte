import type { SupabaseSummary } from "@/lib/supabase";

import { BookCard } from "@/components/book-card";

type BookGridProps = {
  books: (SupabaseSummary & { isRead?: boolean; isFavorited?: boolean })[];
  emptyState?: React.ReactNode;
  showDeleteButtons?: boolean;
  showLibraryActions?: boolean;
  userRole?: string | null;
};

export function BookGrid({ 
  books, 
  emptyState, 
  showDeleteButtons = false, 
  showLibraryActions = false,
  userRole = null 
}: BookGridProps) {
  if (!books.length && emptyState) {
    return <div className="py-12 text-center text-sm">{emptyState}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {books.map((book) => (
        <BookCard 
          key={book.id} 
          book={book} 
          showDeleteButton={showDeleteButtons}
          showLibraryActions={showLibraryActions}
          userRole={userRole}
          isRead={book.isRead}
          isFavorited={book.isFavorited}
        />
      ))}
    </div>
  );
}

