"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { EditableTitle } from "@/components/editable-title";
import { SaveToLibraryButton } from "@/components/save-to-library-button";
import { LibraryActions } from "@/components/library-actions";
import { VisibilityToggle } from "@/components/visibility-toggle";
import { CoverUpload } from "@/components/cover-upload";
import { DownloadPdfButton } from "@/components/download-pdf-button";
import { UploadSummaryButton } from "@/components/upload-summary-button";
import { UploadChaptersButton } from "@/components/upload-chapters-button";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { SupabaseSummary } from "@/lib/supabase";
import type { SummaryPayload } from "@/lib/schemas";

type BookHeroClientProps = {
  book: SupabaseSummary;
  isOwner: boolean;
  canEdit: boolean;
  canDelete: boolean;
  userRole: string | null;
  initialIsSavedToLibrary: boolean;
  initialIsRead: boolean;
  initialIsFavorited: boolean;
};

// Count words in a summary
function countSummaryWords(summary: SummaryPayload): number {
  let wordCount = 0;

  // Check if summary is structured format
  const isStructured = summary && typeof summary === 'object' && 'quick_summary' in summary && typeof (summary as Record<string, unknown>).quick_summary === 'string';

  if (!isStructured) {
    // For raw text summaries, count words in raw_text
    if ('raw_text' in summary && typeof (summary as { raw_text: string }).raw_text === 'string') {
      return (summary as { raw_text: string }).raw_text.split(/\s+/).filter(word => word.length > 0).length;
    }
    return 0;
  }

  const structured = summary as { quick_summary?: string; key_ideas?: Array<{ title?: string; text?: string }>; chapters?: Array<{ title?: string; summary?: string }>; actionable_insights?: string[]; quotes?: string[] };

  // Count words in quick_summary
  if (structured.quick_summary) {
    wordCount += structured.quick_summary.split(/\s+/).filter(word => word.length > 0).length;
  }

  // Count words in key_ideas (title + text)
  if (structured.key_ideas) {
    structured.key_ideas.forEach(idea => {
      if (idea.title) {
        wordCount += idea.title.split(/\s+/).filter(word => word.length > 0).length;
      }
      if (idea.text) {
        wordCount += idea.text.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }

  // Count words in chapters (title + summary)
  if (structured.chapters) {
    structured.chapters.forEach(chapter => {
      if (chapter.title) {
        wordCount += chapter.title.split(/\s+/).filter(word => word.length > 0).length;
      }
      if (chapter.summary) {
        wordCount += chapter.summary.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }

  // Count words in actionable_insights
  if (structured.actionable_insights) {
    structured.actionable_insights.forEach(insight => {
      if (insight) {
        wordCount += insight.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }

  // Count words in quotes
  if (structured.quotes) {
    structured.quotes.forEach(quote => {
      if (quote) {
        wordCount += quote.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }

  return wordCount;
}

export function BookHeroClient({
  book,
  isOwner,
  canEdit,
  canDelete,
  userRole,
  initialIsSavedToLibrary,
  initialIsRead,
  initialIsFavorited,
}: BookHeroClientProps) {
  const [isSavedToLibrary, setIsSavedToLibrary] = useState(initialIsSavedToLibrary);
  const [isRead, setIsRead] = useState(initialIsRead);
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const router = useRouter();

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/books/${book.id}/delete`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete book");
      }

      const result = await response.json();

      toast.success("Book deleted successfully");
      router.push("/library");
      router.refresh();
    } catch (error) {
      console.error("Error deleting book:", error);
      toast.error("Failed to delete book");
    }
  };

  const handleRemoveFromLibrary = () => {
    setIsSavedToLibrary(false);
    setIsRead(false);
    setIsFavorited(false);
  };

  const handleMarkAsRead = () => {
    setIsRead(!isRead);
  };

  const handleToggleFavorite = () => {
    setIsFavorited(!isFavorited);
  };

  return (
    <section className="flex flex-col gap-6 rounded-4xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6 md:flex-row md:items-center md:gap-10">
      <div className="relative h-48 w-36 flex-shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-[rgb(var(--accent))] to-purple-500">
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={book.title}
            fill
            sizes="(min-width: 768px) 144px, 50vw"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="space-y-3 flex-1">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent))]" />
          Book summary
        </div>
        <EditableTitle
          bookId={book.id}
          initialTitle={book.title}
          isEditable={canEdit}
        />
        {book.author ? (
          <p className="text-sm text-[rgb(var(--muted-foreground))]">{book.author}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[rgb(var(--muted-foreground))]">
          <span>
            {new Intl.DateTimeFormat("en", {
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(new Date(book.created_at))}
          </span>
          {typeof book.progress_percent === "number" ? (
            <span>{Math.round(book.progress_percent)}% complete</span>
          ) : null}
          <span className="font-semibold text-[rgb(var(--foreground))]">
            {countSummaryWords(book.summary).toLocaleString()} words
          </span>
        </div>

        {/* Download PDF button - available to all users */}
        <div className="pt-2">
          <DownloadPdfButton
            bookTitle={book.title}
            bookAuthor={book.author}
            summary={book.summary}
          />
        </div>

        {/* Edit controls (owner or editor) */}
        {canEdit && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap gap-2">
              <UploadSummaryButton bookId={book.id} />
              {userRole === "editor" ? <UploadChaptersButton bookId={book.id} /> : null}
            </div>

            {/* Editor-only controls */}
            {userRole === "editor" ? (
              <>
                <VisibilityToggle bookId={book.id} initialIsPublic={book.is_public} />
                <CoverUpload
                  bookId={book.id}
                  currentCoverUrl={book.cover_url}
                />
              </>
            ) : null}
          </div>
        )}

        {/* Regular user controls */}
        {userRole === "regular" && book.is_public && (
          <div className="space-y-4 pt-2">
            <SaveToLibraryButton
              bookId={book.id}
              isSaved={isSavedToLibrary}
            />
            {isSavedToLibrary && (
              <LibraryActions
                bookId={book.id}
                bookTitle={book.title}
                isRead={isRead}
                isFavorited={isFavorited}
                onRemove={handleRemoveFromLibrary}
                onMarkAsRead={handleMarkAsRead}
                onToggleFavorite={handleToggleFavorite}
              />
            )}
          </div>
        )}


        {/* Delete button (Owner or Editor) */}
        {canDelete && (
          <div className="pt-4 border-t border-[rgb(var(--border))] mt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full sm:w-auto">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Book
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the book
                    &nbsp;&quot;{book.title}&quot; and remove all data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

      </div>
    </section>
  );
}

