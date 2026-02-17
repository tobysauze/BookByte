"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, CheckSquare, XSquare } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseSummary } from "@/lib/supabase";
import { BookCard } from "@/components/book-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type BookGridProps = {
  books: (SupabaseSummary & { isRead?: boolean; isFavorited?: boolean })[];
  emptyState?: React.ReactNode;
  showDeleteButtons?: boolean;
  showLibraryActions?: boolean;
  userRole?: string | null;
  enableMultiSelect?: boolean;
};

export function BookGrid({
  books,
  emptyState,
  showDeleteButtons = false,
  showLibraryActions = false,
  userRole = null,
  enableMultiSelect = false,
}: BookGridProps) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDeleting, startTransition] = useTransition();
  const router = useRouter();

  if (!books.length && emptyState) {
    return <div className="py-12 text-center text-sm">{emptyState}</div>;
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(books.map((b) => b.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setShowConfirmDialog(true);
  };

  const confirmBulkDelete = () => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/books/bulk-delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookIds: Array.from(selectedIds) }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to delete books");
        }

        const data = await response.json();
        toast.success(data.message || `${selectedIds.size} book(s) deleted`);
        exitSelectionMode();
        router.refresh();
      } catch (error) {
        console.error("Bulk delete error:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to delete books"
        );
      }
    });
    setShowConfirmDialog(false);
  };

  return (
    <div>
      {/* Selection toolbar for editors */}
      {enableMultiSelect && (
        <div className="mb-6">
          {!selectionMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectionMode(true)}
              className="gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              Select Books
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3">
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All ({books.length})
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0 || isDeleting}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeleting
                    ? "Deleting..."
                    : `Delete ${selectedIds.size > 0 ? `(${selectedIds.size})` : ""}`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exitSelectionMode}
                  className="gap-2"
                >
                  <XSquare className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Book grid */}
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {books.map((book) => (
          <div key={book.id} className="relative">
            {/* Selection checkbox overlay */}
            {selectionMode && (
              <div
                className="absolute left-3 top-3 z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelection(book.id);
                }}
              >
                <Checkbox
                  checked={selectedIds.has(book.id)}
                  onCheckedChange={() => toggleSelection(book.id)}
                  className="h-5 w-5 border-2 bg-white shadow-md data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                />
              </div>
            )}

            {/* Dim unselected cards in selection mode */}
            <div
              className={
                selectionMode && !selectedIds.has(book.id)
                  ? "opacity-50 transition-opacity"
                  : "transition-opacity"
              }
            >
              <BookCard
                book={book}
                showDeleteButton={showDeleteButtons}
                showLibraryActions={showLibraryActions && !selectionMode}
                userRole={userRole}
                isRead={book.isRead}
                isFavorited={book.isFavorited}
                disableNavigation={selectionMode}
                onSelectionClick={
                  selectionMode ? () => toggleSelection(book.id) : undefined
                }
              />
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete books?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently delete{" "}
              <strong>{selectedIds.size}</strong> book
              {selectedIds.size !== 1 ? "s" : ""}. This action cannot be undone.
              All associated data including summaries, covers, and files will be
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Yes, delete {selectedIds.size} book
              {selectedIds.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
