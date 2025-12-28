"use client";

import { useState } from "react";

import { SummaryContent } from "@/components/summary-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UploadBox } from "@/components/upload-box";
import { SummaryPreviewDialog } from "@/components/summary-preview-dialog";
import { PromptRatingDialog } from "@/components/prompt-rating-dialog";
import type { SummaryPayload } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type SummarizeResponse = {
  bookId: string | null;
  summary: SummaryPayload;
  metadata: {
    title: string;
    author?: string | null;
    coverUrl?: string | null;
  };
  analysis?: {
    coverage: number;
    chaptersCovered: number;
    chaptersMissing: number;
    totalChapters: number;
    hasTableOfContents: boolean;
  };
  _fileInfo?: {
    fileUrl?: string | null;
    localFilePath?: string | null;
  };
  _originalText?: string | null;
};

type HomeClientProps = {
  initialUserEmail: string | null;
};

export function HomeClient({ initialUserEmail }: HomeClientProps) {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [metadata, setMetadata] = useState<SummarizeResponse["metadata"] | null>(null);
  const [analysis, setAnalysis] = useState<SummarizeResponse["analysis"] | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ fileUrl?: string | null; localFilePath?: string | null } | null>(null);
  const [promptId, setPromptId] = useState<string | null>(null);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [promptName, setPromptName] = useState<string>("");
  const [originalText, setOriginalText] = useState<string | null>(null);

  const handleUpload = async (files: File[], customPrompt?: string, model?: string, promptIdParam?: string) => {
    setError(null);
    setIsSummarizing(true);
    setSummary(null);
    setMetadata(null);
    setAnalysis(null);
    setBookId(null);
    setPromptId(promptIdParam || null);
    setOriginalText(null);

    try {
      const formData = new FormData();
      
      // If multiple files, send them all; if single file, use existing format
      if (files.length > 1) {
        files.forEach((file) => {
          formData.append("files", file);
        });
      } else {
        formData.append("file", files[0]);
        formData.append("filename", files[0].name);
      }

      // Add custom prompt if provided
      if (customPrompt) {
        formData.append("customPrompt", customPrompt);
      }

      // Add selected model if provided
      if (model) {
        formData.append("model", model);
      }

      const response = await fetch("/api/summarize", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to summarize the book.");
      }

      const parsed = (await response.json()) as SummarizeResponse;
      setSummary(parsed.summary);
      setMetadata(parsed.metadata);
      setAnalysis(parsed.analysis ?? null);
      setFileInfo(parsed._fileInfo ?? null);
      setOriginalText(parsed._originalText ?? null);
      // Set bookId if provided (should be null now since we don't auto-save)
      if (parsed.bookId) {
        setBookId(parsed.bookId);
      }
      // Show preview dialog after summary is complete
      setShowPreview(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSaveToLibrary = async () => {
    // Don't save if already saved (bookId exists)
    if (!summary || !metadata || bookId) {
      console.log("Skipping save - already saved or missing data", { bookId, hasSummary: !!summary, hasMetadata: !!metadata });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          summary, 
          metadata: {
            ...metadata,
            fileUrl: fileInfo?.fileUrl ?? null,
          }
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to save summary to Supabase.");
      }

      const { bookId: savedId } = (await response.json()) as { bookId: string };
      setBookId(savedId);
      setShowPreview(false);
      
      // Show rating dialog if a custom prompt was used
      if (promptId) {
        setShowRatingDialog(true);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardSummary = () => {
    setSummary(null);
    setMetadata(null);
    setAnalysis(null);
    setBookId(null);
    setFileInfo(null);
    setPromptId(null);
    setShowPreview(false);
  };

  const handleRatePrompt = async (rating: number) => {
    if (!promptId) return;

    try {
      const response = await fetch("/api/prompts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: promptId,
          rating,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save rating.");
      }

      console.log(`Rating ${rating}/10 saved for prompt ${promptId}`);
      
      // Dispatch event to notify other components to reload prompts
      window.dispatchEvent(new Event('promptRatingSaved'));
      
      setPromptId(null);
    } catch (error) {
      console.error("Error saving prompt rating:", error);
    }
  };

  const getPromptName = (): string => {
    if (!promptId) return "";
    // We'll need to fetch from API or store in state
    // For now, return a placeholder
    return "Custom Prompt";
  };

  const disabled = !initialUserEmail;

  const handleUploadWrapper = async (files: File[], customPrompt?: string, model?: string, promptId?: string, promptName?: string) => {
    if (disabled) {
      setError("Please sign in to upload and summarize books.");
      return;
    }

    // Set prompt name if provided
    if (promptName) {
      setPromptName(promptName);
    }

    await handleUpload(files, customPrompt, model, promptId);
  };

  return (
    <div className="space-y-12">
      <section
        className={cn(
          "rounded-4xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6 shadow-sm",
          disabled ? "opacity-60" : "",
        )}
      >
        {disabled ? (
          <div className="mb-6 rounded-3xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted))]/40 p-6 text-center text-sm text-[rgb(var(--muted-foreground))]">
            <strong className="font-semibold text-[rgb(var(--foreground))]">
              Create an account or log in
            </strong>{" "}
            to upload books, generate summaries, and build your BookByte library.
          </div>
        ) : null}
        <UploadBox
          onUpload={handleUploadWrapper}
          isLoading={isSummarizing}
        />
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Summary Preview Dialog */}
      {summary && metadata && (
        <SummaryPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          summary={summary}
          metadata={metadata}
          onSave={handleSaveToLibrary}
          onDiscard={handleDiscardSummary}
          isSaving={isSaving}
          isAutoSaved={!!bookId}
          originalText={originalText}
          title={metadata.title}
          author={metadata.author}
          onExpand={(expandedSummary) => {
            setSummary(expandedSummary);
          }}
        />
      )}

      {/* Prompt Rating Dialog */}
      {promptId && (
        <PromptRatingDialog
          open={showRatingDialog}
          onOpenChange={setShowRatingDialog}
          promptName={promptName || "Custom Prompt"}
          onRate={handleRatePrompt}
        />
      )}

      {summary && metadata && !showPreview ? (
        <section className="space-y-6">
          <div className="flex flex-col gap-4 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[rgb(var(--muted-foreground))]">
                Summary complete
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{metadata.title}</h2>
              {metadata.author ? (
                <p className="text-sm text-[rgb(var(--muted-foreground))]">
                  by {metadata.author}
                </p>
              ) : null}
            </div>
            {bookId ? (
              <Button asChild variant="secondary">
                <a href={`/books/${bookId}`}>View summary</a>
              </Button>
            ) : (
              <Button 
                onClick={handleSaveToLibrary} 
                disabled={isSaving || !!bookId}
                title={bookId ? "Already saved" : undefined}
              >
                {isSaving ? "Saving…" : "Save to Library"}
              </Button>
            )}
          </div>


          <SummaryProviderPanel
            provider={summary.ai_provider || "AI Summary"}
            summary={summary}
            description="Generated summary stored in your library"
          />

          {analysis && (
            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
                Analysis Coverage
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[rgb(var(--muted-foreground))]">Coverage:</span>
                  <span className="ml-2 font-semibold">{analysis.coverage}%</span>
                </div>
                <div>
                  <span className="text-[rgb(var(--muted-foreground))]">Chapters:</span>
                  <span className="ml-2 font-semibold">
                    {analysis.chaptersCovered}/{analysis.totalChapters}
                  </span>
                </div>
                <div>
                  <span className="text-[rgb(var(--muted-foreground))]">TOC Found:</span>
                  <span className="ml-2 font-semibold">
                    {analysis.hasTableOfContents ? "Yes" : "No"}
                  </span>
                </div>
                <div>
                  <span className="text-[rgb(var(--muted-foreground))]">Missing:</span>
                  <span className="ml-2 font-semibold">
                    {analysis.chaptersMissing} chapters
                  </span>
                </div>
              </div>
              {analysis.coverage < 80 && (
                <div className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                  ⚠️ Some chapters may not be fully covered. Consider reviewing the book structure.
                </div>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
              JSON payload
            </h3>
            <pre className="max-h-[360px] overflow-auto rounded-2xl bg-black/90 p-4 text-xs text-white">
{JSON.stringify(summary, null, 2)}
            </pre>
          </div>
        </section>
      ) : null}
    </div>
  );
}

type SummaryProviderPanelProps = {
  provider: string;
  summary: SummaryPayload;
  description?: string;
};

function SummaryProviderPanel({ provider, summary, description }: SummaryProviderPanelProps) {
  return (
    <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6 overflow-hidden">
      <div className="mb-4 space-y-1">
        <Badge className="bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]">
          {provider}
        </Badge>
        {description ? (
          <p className="text-xs text-[rgb(var(--muted-foreground))]">{description}</p>
        ) : null}
      </div>
      <div className="overflow-hidden">
        <SummaryContent 
          summary={summary} 
          activeTab="quick_summary"
          audioUrlBySection={{}}
        />
      </div>
    </div>
  );
}

