"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit2, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EditableTitleProps = {
  bookId: string;
  initialTitle: string;
  isEditable: boolean;
  className?: string;
};

export function EditableTitle({ 
  bookId, 
  initialTitle, 
  isEditable, 
  className = "" 
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = async () => {
    if (title.trim() === initialTitle.trim()) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/books/${bookId}/title`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: title.trim() }),
        });

        if (!response.ok) {
          let errorMessage = "Failed to update title";
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
        console.log("Title update response:", result);

        toast.success("Title updated successfully");
        setIsEditing(false);
        router.refresh();
      } catch (error) {
        console.error("Error updating title:", error);
        toast.error(error instanceof Error ? error.message : "Failed to update title");
        setTitle(initialTitle); // Reset to original title on error
      }
    });
  };

  const handleCancel = () => {
    setTitle(initialTitle);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!isEditable) {
    return (
      <h1 className={`text-3xl font-semibold sm:text-4xl ${className}`}>
        {title}
      </h1>
    );
  }

  if (isEditing) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-3xl font-semibold sm:text-4xl h-auto py-2 px-0 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={isPending}
          autoFocus
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={isPending || !title.trim()}
            className="h-8 w-8 p-0"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isPending}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 group ${className}`}>
      <h1 className="text-3xl font-semibold sm:text-4xl">
        {title}
      </h1>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit2 className="h-4 w-4" />
      </Button>
    </div>
  );
}






