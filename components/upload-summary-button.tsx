"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

type UploadSummaryButtonProps = {
  bookId: string;
};

export function UploadSummaryButton({ bookId }: UploadSummaryButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!summaryText.trim()) {
      toast.error("Please enter summary text");
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch(`/api/books/${bookId}/upload-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summaryText: summaryText.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload summary");
      }

      const result = await response.json();
      toast.success("Summary uploaded and organized successfully!");
      setIsOpen(false);
      setSummaryText("");
      
      // Refresh the page to show the updated summary
      router.refresh();
    } catch (error) {
      console.error("Error uploading summary:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload summary");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Upload Summary
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Summary</DialogTitle>
          <DialogDescription>
            Paste your summary text below. The system will automatically organize it into the correct sections (Quick Summary, Key Ideas, Chapters, Insights, Quotes).
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="summary-text">
              Summary Text <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="summary-text"
              placeholder="Paste your complete summary text here. Include sections, chapters, key points, quotes, etc. The AI will automatically organize everything into the correct format."
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              disabled={isUploading}
              className="min-h-[400px] w-full font-mono text-sm"
            />
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Tip: Include clear section headings, chapter titles, numbered lists, or other organizational markers for best results.
            </p>
          </div>

          <div className="flex gap-4 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setSummaryText("");
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !summaryText.trim()}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Organizing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Organize
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}






