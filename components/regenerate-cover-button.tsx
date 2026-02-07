"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles } from "lucide-react";
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
  const [feedback, setFeedback] = useState("");
  const router = useRouter();

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/books/${bookId}/regenerate-cover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          feedback: feedback.trim() || null,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to regenerate cover";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error("Regenerate cover error:", errorData);
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Handle async response (202 Accepted)
      if (response.status === 202) {
        toast.success(result.message || "Cover regeneration started. It will be ready shortly.");
        setIsOpen(false);
        setFeedback("");
        // Refresh after a delay to show the new cover
        setTimeout(() => {
          router.refresh();
        }, 3000);
      } else {
        toast.success(result.message || "Cover regenerated successfully");
        setIsOpen(false);
        setFeedback("");
        router.refresh();
      }
    } catch (error) {
      console.error("Error regenerating cover:", error);
      toast.error(error instanceof Error ? error.message : "Failed to regenerate cover");
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={!currentCoverUrl}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Regenerate Cover
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Regenerate Book Cover
          </DialogTitle>
          <DialogDescription>
            Generate a new AI cover image. You can provide feedback or corrections
            to improve the result (e.g., "Author name should be 'Richard La Ruina' not 'Richard La'").
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
              Leave empty to regenerate with current book details, or provide specific
              corrections or improvements you'd like to see.
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
                Regenerating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Regenerate Cover
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
