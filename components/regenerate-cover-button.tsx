"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type RegenerateCoverButtonProps = {
  bookId: string;
  currentCoverUrl: string | null;
};

export function RegenerateCoverButton({
  bookId,
  currentCoverUrl,
}: RegenerateCoverButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [coverUrl, setCoverUrl] = useState(currentCoverUrl);
  const router = useRouter();

  const hasCover = Boolean(coverUrl);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/books/${bookId}/regenerate-cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedback.trim() || null }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to regenerate cover";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (response.status === 202) {
        toast.success(result.message || "Cover generation started. It will be ready shortly.");
        setIsOpen(false);
        setFeedback("");
        setTimeout(() => router.refresh(), 3000);
      } else {
        toast.success(result.message || "Cover regenerated successfully");
        setIsOpen(false);
        setFeedback("");
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to regenerate cover");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDeleteCover = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/books/${bookId}/cover`, {
        method: "DELETE",
      });

      if (!response.ok) {
        let errorMessage = "Failed to delete cover";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      setCoverUrl(null);
      toast.success("Cover deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete cover");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" />
            {hasCover ? "Regenerate Cover" : "Generate Cover"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {hasCover ? "Regenerate Book Cover" : "Generate Book Cover"}
            </DialogTitle>
            <DialogDescription>
              Generate a new AI cover image. You can provide feedback or corrections
              to improve the result (e.g., &quot;Use warmer colors. Make the title more prominent.&quot;).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feedback">
                Feedback / Corrections (Optional)
              </Label>
              <Textarea
                id="feedback"
                placeholder="e.g., Author name should be 'Richard La Ruina' not 'Richard La'. Use warmer colors. Make the title more prominent."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to generate with current book details, or provide specific
                corrections or improvements you&apos;d like to see.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setFeedback("");
              }}
              disabled={isRegenerating}
            >
              Cancel
            </Button>
            <Button onClick={handleRegenerate} disabled={isRegenerating}>
              {isRegenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {hasCover ? "Regenerate Cover" : "Generate Cover"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasCover && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDeleteCover}
          disabled={isDeleting}
          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
          title="Delete cover"
        >
          {isDeleting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
