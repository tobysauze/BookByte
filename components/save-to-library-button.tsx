"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

type SaveToLibraryButtonProps = {
  bookId: string;
  isSaved?: boolean;
  className?: string;
};

export function SaveToLibraryButton({ 
  bookId, 
  isSaved = false, 
  className = "" 
}: SaveToLibraryButtonProps) {
  const [saved, setSaved] = useState(isSaved);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Sync state with prop when it changes (e.g., after page refresh)
  useEffect(() => {
    setSaved(isSaved);
  }, [isSaved]);

  const handleToggle = async () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/user-library/${bookId}`, {
          method: saved ? "DELETE" : "POST",
        });

        if (!response.ok) {
          let errorMessage = saved ? "Failed to remove from library" : "Failed to save to library";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log("Library toggle response:", result);

        setSaved(!saved);
        toast.success(saved ? "Removed from library" : "Saved to library");
        router.refresh();
      } catch (error) {
        console.error("Error toggling library save:", error);
        toast.error(error instanceof Error ? error.message : "Failed to update library");
      }
    });
  };

  return (
    <Button
      onClick={handleToggle}
      disabled={isPending}
      variant={saved ? "default" : "outline"}
      className={className}
    >
      {saved ? (
        <>
          <BookmarkCheck className="mr-2 h-4 w-4" />
          {isPending ? "Removing..." : "Saved"}
        </>
      ) : (
        <>
          <Bookmark className="mr-2 h-4 w-4" />
          {isPending ? "Saving..." : "Save to Library"}
        </>
      )}
    </Button>
  );
}






