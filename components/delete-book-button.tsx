"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Trash2 } from "lucide-react";

type DeleteBookButtonProps = {
  bookId: string;
  bookTitle: string;
};

export function DeleteBookButton({ bookId, bookTitle }: DeleteBookButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = async () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/books/${bookId}/delete`, {
          method: "DELETE",
        });

        if (!response.ok) {
          let errorMessage = "Failed to delete book";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        // Parse the success response
        const result = await response.json();
        console.log("Delete response:", result);

        toast.success("Book deleted successfully");
        router.refresh(); // Refresh the page to update the library
      } catch (error) {
        console.error("Error deleting book:", error);
        toast.error(error instanceof Error ? error.message : "Failed to delete book");
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4" />
          {isPending ? "Deleting..." : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Book</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{bookTitle}"? This action cannot be undone.
            The book summary and any associated files will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700"
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
