"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { VerticalSummaryNav } from "@/components/vertical-summary-nav";
import { EditableSummaryContent } from "@/components/editable-summary-content";
import { ContinuousScrollView } from "@/components/continuous-scroll-view";
import { ContentsMenu } from "@/components/contents-menu";
import { TextSettings } from "@/components/text-settings";
import { Scroll, BookOpen } from "lucide-react";
import { z } from "zod";
import type { SupabaseSummary } from "@/lib/supabase";
import type { SummaryPayload } from "@/lib/schemas";
import { summarySchema } from "@/lib/schemas";
import { RawTextSummaryView } from "@/components/raw-text-summary-view";
import { AudioPlayer } from "@/components/audio-player";
import { toast } from "sonner";

type BookSummaryClientProps = {
  book: SupabaseSummary;
  canEdit?: boolean;
};

// Only use structured summary keys (not raw_text variant)
type SummarySectionKey = keyof z.infer<typeof summarySchema>;
type NarrationSectionKey = SummarySectionKey | "full_summary";

// Type guard for structured summaries
function isStructuredSummary(summary: SummaryPayload): summary is z.infer<typeof summarySchema> {
  return summary && typeof summary === 'object' && 'quick_summary' in summary && typeof (summary as Record<string, unknown>).quick_summary === 'string';
}

export function BookSummaryClient({ book, canEdit = false }: BookSummaryClientProps) {
  // Wrapper: no hooks that depend on structured summary.
  if (!isStructuredSummary(book.summary)) {
    if (book.summary && typeof book.summary === "object" && "raw_text" in book.summary) {
      const rawText = (book.summary as { raw_text: string }).raw_text;
      return <RawTextSummaryView bookId={book.id} content={rawText} />;
    }

    return (
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8 text-center text-[rgb(var(--muted-foreground))]">
        <p>This book summary is not available in the structured format.</p>
        <p className="text-xs mt-2">ID: {book.id}</p>
      </div>
    );
  }

  return <StructuredBookSummaryClient book={book} canEdit={canEdit} />;
}

function StructuredBookSummaryClient({ book, canEdit }: BookSummaryClientProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SummarySectionKey>("quick_summary");
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isContentsOpen, setIsContentsOpen] = useState(false);
  const [, setAudioMap] = useState<Record<string, string>>(
    (book.audio_urls ?? {}) as Record<string, string>,
  );
  const [isAudioVisible, setIsAudioVisible] = useState(true);
  const [currentAudio, setCurrentAudio] = useState<{ src: string; title: string } | null>(() => {
    const src = (book.audio_urls ?? {}) as Record<string, string>;
    if (typeof src.full_summary === "string" && src.full_summary.length > 0) {
      return { src: src.full_summary, title: "Full Summary narration" };
    }
    return null;
  });

  const structuredSummary = book.summary as z.infer<typeof summarySchema>;
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isContinuousScroll, setIsContinuousScroll] = useState(() => {
    // Load preference from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bookSummaryViewMode');
      return saved === 'continuous';
    }
    return false;
  });

  // Handle URL parameters for navigation from highlights
  useEffect(() => {
    const section = searchParams.get("section");
    const itemIndex = searchParams.get("itemIndex");

    if (section && ["quick_summary", "key_ideas", "chapters", "actionable_insights", "quotes"].includes(section)) {
      setActiveTab(section as SummarySectionKey);
      if (itemIndex) {
        const index = parseInt(itemIndex, 10);
        if (!isNaN(index) && index >= 0) {
          setCurrentItemIndex(index);
        }
      }
    }
  }, [searchParams]);

  // Scroll to highlight after content is loaded
  useEffect(() => {
    const highlightId = searchParams.get("highlightId");
    if (!highlightId) return;

    const timeouts: NodeJS.Timeout[] = [];
    let attempts = 0;
    const maxAttempts = 10;

    // Wait for content to render and then scroll to highlight
    const scrollToHighlight = (): boolean => {
      const highlightElement = document.getElementById(`highlight-${highlightId}`);
      if (highlightElement) {
        // Add a temporary flash animation with a brighter highlight
        const originalBg = highlightElement.style.backgroundColor;
        highlightElement.style.backgroundColor = "rgb(250 204 21)"; // Bright yellow
        highlightElement.style.transition = "background-color 2s ease";

        highlightElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest"
        });

        // Remove flash animation and restore original color after a delay
        setTimeout(() => {
          highlightElement.style.backgroundColor = originalBg || "";
          setTimeout(() => {
            highlightElement.style.transition = "";
          }, 2000);
        }, 2000);

        // Clean up URL parameter after scrolling
        const url = new URL(window.location.href);
        url.searchParams.delete("highlightId");
        window.history.replaceState({}, "", url.toString());

        return true; // Successfully scrolled
      }
      return false; // Element not found yet
    };

    // Try scrolling with retries
    const tryScroll = () => {
      if (scrollToHighlight()) {
        // Success, clean up all pending timeouts
        timeouts.forEach(clearTimeout);
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        const timeoutId = setTimeout(() => {
          tryScroll();
        }, 200 * attempts); // Exponential backoff: 200ms, 400ms, 600ms, etc.
        timeouts.push(timeoutId);
      }
    };

    // Start trying immediately
    tryScroll();

    return () => {
      // Clean up all timeouts on unmount or dependency change
      timeouts.forEach(clearTimeout);
    };
  }, [activeTab, currentItemIndex, searchParams]);

  const handleGenerateAudio = async (section: NarrationSectionKey) => {
    setError(null);
    try {
      setIsGenerating(true);
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          section,
        }),
      });

      if (!response.ok) {
        let message = "Failed to generate audio.";
        try {
          const data = (await response.json()) as { error?: string };
          if (typeof data?.error === "string" && data.error.length > 0) {
            message = data.error;
          }
        } catch {
          const text = await response.text().catch(() => "");
          if (text) message = text;
        }
        throw new Error(message);
      }

      const data = (await response.json()) as {
        audioUrl: string | null;
        cached?: boolean;
        fallback?: "speechSynthesis";
        fallbackText?: string;
      };

      if (data.audioUrl) {
        setAudioMap((prev) => ({ ...prev, [section]: data.audioUrl! }));
        setIsAudioVisible(true);
        setCurrentAudio({
          src: data.audioUrl,
          title: section === "full_summary" ? "Full Summary narration" : "Narration",
        });
        toast.success(data.cached ? "Audio ready (cached)" : "Audio ready");
        return data.audioUrl;
      }

      if (data.fallback === "speechSynthesis" && typeof data.fallbackText === "string") {
        // Free backup: use device TTS (not cached).
        try {
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(data.fallbackText);
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
            toast.message("Using device text-to-speech (fallback)");
            return undefined;
          }
        } catch (e) {
          console.error("SpeechSynthesis fallback failed:", e);
        }
      }

      throw new Error("Failed to generate audio.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
      toast.error(err instanceof Error ? err.message : "Failed to generate audio");
      return undefined;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSectionChange = (section: SummarySectionKey) => {
    setActiveTab(section);
    const newSectionItems = getSectionItems(section);
    const safeIndex = newSectionItems.length > 0 ? 0 : 0;
    setCurrentItemIndex(safeIndex);
  };

  const handleItemChange = (index: number) => {
    const currentSectionItems = getSectionItems(activeTab);
    const safeIndex = Math.max(0, Math.min(index, currentSectionItems.length - 1));
    setCurrentItemIndex(safeIndex);
  };

  // Items per page for pagination
  const ITEMS_PER_PAGE = 5;

  const handlePrevious = () => {
    if (activeTab === "quick_summary") {
      // Go to last page of previous section
      if (structuredSummary.quotes.length > 0) {
        setActiveTab("quotes");
        const lastPage = Math.floor((structuredSummary.quotes.length - 1) / ITEMS_PER_PAGE);
        setCurrentItemIndex(lastPage * ITEMS_PER_PAGE);
      } else if (structuredSummary.actionable_insights.length > 0) {
        setActiveTab("actionable_insights");
        const lastPage = Math.floor((structuredSummary.actionable_insights.length - 1) / ITEMS_PER_PAGE);
        setCurrentItemIndex(lastPage * ITEMS_PER_PAGE);
      } else if (structuredSummary.chapters.length > 0) {
        setActiveTab("chapters");
        const lastPage = Math.floor((structuredSummary.chapters.length - 1) / ITEMS_PER_PAGE);
        setCurrentItemIndex(lastPage * ITEMS_PER_PAGE);
      } else if (structuredSummary.key_ideas.length > 0) {
        setActiveTab("key_ideas");
        const lastPage = Math.floor((structuredSummary.key_ideas.length - 1) / ITEMS_PER_PAGE);
        setCurrentItemIndex(lastPage * ITEMS_PER_PAGE);
      }
    } else {
      // Calculate current page
      const currentPage = Math.floor(currentItemIndex / ITEMS_PER_PAGE);

      if (currentPage > 0) {
        // Go to previous page
        setCurrentItemIndex((currentPage - 1) * ITEMS_PER_PAGE);
      } else {
        // Go to previous section
        const sectionOrder: SummarySectionKey[] = ["quick_summary", "key_ideas", "chapters", "actionable_insights", "quotes"];
        const currentIndex = sectionOrder.indexOf(activeTab);
        if (currentIndex > 0) {
          const prevSection = sectionOrder[currentIndex - 1];
          setActiveTab(prevSection);
          if (prevSection === "quick_summary") {
            setCurrentItemIndex(0);
          } else {
            const prevSectionItems = getSectionItems(prevSection);
            const lastPage = Math.floor((prevSectionItems.length - 1) / ITEMS_PER_PAGE);
            setCurrentItemIndex(lastPage * ITEMS_PER_PAGE);
          }
        }
      }
    }
  };

  const handleNext = () => {
    const currentSectionItems = getSectionItems(activeTab);

    // If current section has no items, skip to next section
    if (currentSectionItems.length === 0) {
      const sectionOrder: SummarySectionKey[] = ["quick_summary", "key_ideas", "chapters", "actionable_insights", "quotes"];
      const currentIndex = sectionOrder.indexOf(activeTab);
      if (currentIndex < sectionOrder.length - 1) {
        const nextSection = sectionOrder[currentIndex + 1];
        setActiveTab(nextSection);
        setCurrentItemIndex(0);
      }
      return;
    }

    // Calculate current page and next page
    const currentPage = Math.floor(currentItemIndex / ITEMS_PER_PAGE);
    const nextPageIndex = (currentPage + 1) * ITEMS_PER_PAGE;

    if (nextPageIndex < currentSectionItems.length) {
      // Go to next page in same section
      setCurrentItemIndex(nextPageIndex);
    } else {
      // Go to next section
      const sectionOrder: SummarySectionKey[] = ["quick_summary", "key_ideas", "chapters", "actionable_insights", "quotes"];
      const currentIndex = sectionOrder.indexOf(activeTab);
      if (currentIndex < sectionOrder.length - 1) {
        const nextSection = sectionOrder[currentIndex + 1];
        setActiveTab(nextSection);
        setCurrentItemIndex(0);
      }
    }
  };

  const getSectionItems = (section: SummarySectionKey) => {
    switch (section) {
      case "quick_summary":
        return [structuredSummary.quick_summary];
      case "key_ideas":
        return structuredSummary.key_ideas;
      case "chapters":
        return structuredSummary.chapters;
      case "actionable_insights":
        return structuredSummary.actionable_insights;
      case "quotes":
        return structuredSummary.quotes;
      case "short_summary":
        return [structuredSummary.short_summary];
      case "ai_provider":
        return [structuredSummary.ai_provider || "Unknown"];
      default:
        return [];
    }
  };

  const handleViewModeToggle = (continuous: boolean) => {
    setIsContinuousScroll(continuous);
    // Save preference to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('bookSummaryViewMode', continuous ? 'continuous' : 'paginated');
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <TextSettings />
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
            <button
              onClick={() => handleViewModeToggle(false)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${!isContinuousScroll
                ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]'
                : 'text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]'
                }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Paginated</span>
            </button>
            <button
              onClick={() => handleViewModeToggle(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${isContinuousScroll
                ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]'
                : 'text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]'
                }`}
            >
              <Scroll className="h-4 w-4" />
              <span>Continuous Scroll</span>
            </button>
          </div>
        </div>
        {book.file_url ? (
          <Button asChild variant="secondary" size="sm">
            <a href={book.file_url} target="_blank" rel="noopener noreferrer">
              Download source file
            </a>
          </Button>
        ) : null}
      </div>

      {/* Error Message */}
      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50/80 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Summary Section with Sidebar */}
      <>
        <div className="flex">
          {/* Vertical Navigation Sidebar */}
          <VerticalSummaryNav
            summary={book.summary}
            activeTab={activeTab}
            onTabChange={handleSectionChange}
            onGenerateAudio={handleGenerateAudio}
            isGenerating={isGenerating}
            onContentsClick={() => setIsContentsOpen(true)}
          />

          {/* Main Summary Content */}
          <div className="flex-1 pl-2">
            {isContinuousScroll ? (
              <ContinuousScrollView
                book={book}
                canEdit={canEdit}
              />
            ) : (
              <EditableSummaryContent
                book={book}
                activeTab={activeTab as string}
                currentItemIndex={currentItemIndex}
                onSectionChange={handleSectionChange as (section: string) => void}
                onItemChange={handleItemChange}
                onPrevious={handlePrevious}
                onNext={handleNext}
                canEdit={canEdit}
              />
            )}
          </div>
        </div>

        {/* Floating audio player (appears after generation) */}
        {isAudioVisible && currentAudio?.src ? (
          <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)]">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-1 text-xs text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                onClick={() => setIsAudioVisible(false)}
              >
                Hide
              </button>
            </div>
            <AudioPlayer
              src={currentAudio.src}
              title={currentAudio.title}
              autoPlay
            />
          </div>
        ) : null}

        {/* Contents Menu - Only show if not raw text */}
        <ContentsMenu
          summary={book.summary}
          currentSection={activeTab}
          currentItemIndex={currentItemIndex}
          onSectionChange={handleSectionChange}
          onItemChange={handleItemChange}
          onClose={() => setIsContentsOpen(false)}
          isOpen={isContentsOpen}
        />
      </>
    </div>
  );
}

