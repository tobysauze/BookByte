"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { 
  BookOpenCheck, 
  Heart, 
  Trash2, 
  CheckCircle,
  Loader2 
} from "lucide-react";

type LibraryActionsProps = {
  bookId: string;
  bookTitle: string;
  isRead?: boolean;
  isFavorited?: boolean;
  onRemove?: () => void;
  onMarkAsRead?: () => void;
  onToggleFavorite?: () => void;
};

export function LibraryActions({ 
  bookId, 
  bookTitle, 
  isRead = false,
  isFavorited = false,
  onRemove,
  onMarkAsRead,
  onToggleFavorite
}: LibraryActionsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleRemoveFromLibrary = async () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/user-library/${bookId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          let errorMessage = "Failed to remove from library";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        toast.success("Removed from library");
        onRemove?.();
        router.refresh();
      } catch (error) {
        console.error("Error removing from library:", error);
        toast.error(error instanceof Error ? error.message : "Failed to remove from library");
      }
    });
  };

  const handleMarkAsRead = async () => {
    startTransition(async () => {
      try {
        const method = isRead ? "DELETE" : "POST";
        const action = isRead ? "removing from read list" : "marking as read";
        
        console.log(`${action}:`, bookId);
        const response = await fetch(`/api/user-read-books/${bookId}`, {
          method,
        });

        if (!response.ok) {
          let errorMessage = `Failed to ${action}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            console.error("API Error Response:", errorData);
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        toast.success(isRead ? "Removed from read list" : "Marked as read");
        onMarkAsRead?.();
        router.refresh();
      } catch (error) {
        console.error(`Error ${isRead ? 'removing from read list' : 'marking as read'}:`, error);
        toast.error(error instanceof Error ? error.message : `Failed to ${isRead ? 'remove from read list' : 'mark as read'}`);
      }
    });
  };

  const handleToggleFavorite = async () => {
    startTransition(async () => {
      try {
        const method = isFavorited ? "DELETE" : "POST";
        const response = await fetch(`/api/user-favorites/${bookId}`, {
          method,
        });

        if (!response.ok) {
          let errorMessage = isFavorited ? "Failed to remove from favorites" : "Failed to add to favorites";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        toast.success(isFavorited ? "Removed from favorites" : "Added to favorites");
        onToggleFavorite?.();
        router.refresh();
      } catch (error) {
        console.error("Error toggling favorite:", error);
        toast.error(error instanceof Error ? error.message : "Failed to update favorites");
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* Remove from Library */}
      <Button
        onClick={handleRemoveFromLibrary}
        disabled={isPending}
        variant="outline"
        size="sm"
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" />
        )}
        Remove from Library
      </Button>

      {/* Mark as Read / Remove from Read */}
      <Button
        onClick={handleMarkAsRead}
        disabled={isPending}
        variant="outline"
        size="sm"
        className={isRead ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : isRead ? (
          <CheckCircle className="mr-2 h-4 w-4" />
        ) : (
          <BookOpenCheck className="mr-2 h-4 w-4" />
        )}
        {isRead ? "Remove from Read" : "Mark as Read"}
      </Button>

      {/* Add to Favorites */}
      <Button
        onClick={handleToggleFavorite}
        disabled={isPending}
        variant="outline"
        size="sm"
        className={isFavorited ? "text-red-600 bg-red-50" : "text-gray-600 hover:text-red-600 hover:bg-red-50"}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Heart className={`mr-2 h-4 w-4 ${isFavorited ? "fill-current" : ""}`} />
        )}
        {isFavorited ? "Favorited" : "Add to Favorites"}
      </Button>
    </div>
  );
}
