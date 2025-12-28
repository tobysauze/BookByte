"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GapReportDisplay } from "@/components/gap-report-display";
import { EnhancementPreview } from "@/components/enhancement-preview";
import type { GapReport } from "@/lib/gap-detection";
import type { SummaryPayload } from "@/lib/schemas";

type EnhanceSummaryButtonProps = {
  bookId: string;
  canEdit?: boolean;
};

type PreviewData = {
  changes: Array<{
    gapId: string;
    type: string;
    section: string;
    title: string;
    original?: string;
    enhanced: string;
    action: "added" | "modified";
  }>;
  enhancedSummary: SummaryPayload;
  originalSummary: SummaryPayload;
  warnings?: string[];
};

export function EnhanceSummaryButton({ bookId, canEdit = false }: EnhanceSummaryButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gapReport, setGapReport] = useState<GapReport | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/books/${bookId}/enhance`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze summary");
      }

      const data = await response.json();
      setGapReport(data.gapReport);
      setIsOpen(true);
    } catch (error) {
      console.error("Error analyzing gaps:", error);
      toast.error(error instanceof Error ? error.message : "Failed to analyze summary");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnhance = async (gapIds: string[]) => {
    setIsEnhancing(true);
    try {
      const response = await fetch(`/api/books/${bookId}/enhance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "selected",
          gapIds,
          preview: true, // Request preview mode
        }),
      });

      // Parse JSON response (works even for error responses)
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails, the response is likely not JSON
        console.error("Failed to parse JSON response:", jsonError);
        throw new Error(`Server returned invalid response. Check server logs for details.`);
      }
      
      if (!response.ok) {
        // Even if response is not ok, check if it has preview data to show
        if (data.preview) {
          setPreviewData({
            changes: data.changes || [],
            enhancedSummary: data.enhancedSummary || data.originalSummary,
            originalSummary: data.originalSummary,
            warnings: data.warnings || [data.error || "Failed to enhance summary"],
          });
          setGapReport(null); // Hide gap report, show preview
          toast.error(data.error || "Failed to enhance summary");
          return; // Don't throw, let the preview dialog show the error
        }
        
        // If no preview data, throw the error
        throw new Error(data.error || "Failed to enhance summary");
      }
      
      if (data.preview) {
        // Show preview (even if changes array is empty)
        setPreviewData({
          changes: data.changes || [],
          enhancedSummary: data.enhancedSummary,
          originalSummary: data.originalSummary,
          warnings: data.warnings || [],
        });
        setGapReport(null); // Hide gap report, show preview
        
        if (data.changes && data.changes.length > 0) {
          toast.success(`Generated preview for ${data.changes.length} change(s)`);
        } else {
          toast.warning(data.message || "No changes were generated. Check the preview for details.");
        }
      } else {
        // Fallback to old behavior if preview not available
        toast.success(data.message || "Summary enhanced successfully!");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error("Error enhancing summary:", error);
      toast.error(error instanceof Error ? error.message : "Failed to enhance summary");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSaveApproved = () => {
    // Close dialog and refresh page
    setIsOpen(false);
    setPreviewData(null);
    setGapReport(null);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleClosePreview = () => {
    setPreviewData(null);
    setGapReport(null);
    setIsOpen(false);
  };

  if (!canEdit) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleAnalyze}
        disabled={isLoading}
        variant="outline"
        className="flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Enhance Summary
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {previewData ? (
            <>
              <DialogHeader>
                <DialogTitle>Review Enhancements</DialogTitle>
                <DialogDescription>
                  Preview the changes before saving. Select which enhancements to keep.
                </DialogDescription>
              </DialogHeader>
              <EnhancementPreview
                changes={previewData.changes}
                enhancedSummary={previewData.enhancedSummary}
                originalSummary={previewData.originalSummary}
                bookId={bookId}
                warnings={previewData.warnings}
                onClose={handleClosePreview}
                onSave={handleSaveApproved}
              />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Enhance Summary</DialogTitle>
                <DialogDescription>
                  Review gaps and select which improvements to make to your summary.
                </DialogDescription>
              </DialogHeader>
              {gapReport && (
                <GapReportDisplay
                  gapReport={gapReport}
                  onEnhance={handleEnhance}
                  isEnhancing={isEnhancing}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

