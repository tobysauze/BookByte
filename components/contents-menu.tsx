"use client";

import { useEffect } from "react";
import { BookOpen, Lightbulb, List, Target, Quote, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { z } from "zod";
import type { SummaryPayload } from "@/lib/schemas";
import { summarySchema } from "@/lib/schemas";

// Only use structured summary keys (not raw_text variant)
type SummarySectionKey = keyof z.infer<typeof summarySchema>;

type ContentsMenuProps = {
  summary: SummaryPayload;
  currentSection: SummarySectionKey;
  currentItemIndex: number;
  onSectionChange: (section: SummarySectionKey) => void;
  onItemChange: (index: number) => void;
  onClose: () => void;
  isOpen: boolean;
};

const sectionIcons: Record<SummarySectionKey, LucideIcon> = {
  quick_summary: BookOpen,
  short_summary: BookOpen,
  key_ideas: Lightbulb,
  chapters: List,
  actionable_insights: Target,
  quotes: Quote,
  ai_provider: BookOpen,
};

const sectionLabels: Record<SummarySectionKey, string> = {
  quick_summary: "Quick Summary",
  short_summary: "Short Summary",
  key_ideas: "Key Ideas",
  chapters: "Chapters",
  actionable_insights: "Insights",
  quotes: "Quotes",
  ai_provider: "AI Provider",
};

// Type guard for structured summaries
function isStructuredSummary(summary: SummaryPayload): summary is z.infer<typeof summarySchema> {
  return summary && typeof summary === 'object' && 'quick_summary' in summary && typeof (summary as Record<string, unknown>).quick_summary === 'string';
}

export function ContentsMenu({
  summary,
  currentSection,
  currentItemIndex,
  onSectionChange,
  onItemChange,
  onClose,
  isOpen,
}: ContentsMenuProps) {
  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Prevent scrolling
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore scroll position when menu closes
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;
  
  // Ensure summary is structured
  if (!isStructuredSummary(summary)) {
    return null; // Don't show contents for raw text summaries
  }
  
  const structuredSummary = summary;
  const isFullPastedChapter = (title: string) =>
    title.startsWith("Full Summary (pasted)");

  const chapterItems = structuredSummary.chapters.map((chapter, index) => ({
    chapter,
    index,
  }));

  const normalChapters = chapterItems.filter(({ chapter }) => !isFullPastedChapter(chapter.title));
  const fullPastedChapters = chapterItems.filter(({ chapter }) => isFullPastedChapter(chapter.title));

  const handleItemClick = (section: SummarySectionKey, index: number) => {
    onSectionChange(section);
    onItemChange(index);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50" onClick={onClose}>
      <div 
        className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-[rgb(var(--background))] border-r border-[rgb(var(--border))] overflow-y-auto shadow-2xl z-[101]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Contents</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Contents List */}
          <div className="space-y-4">
            {/* Quick Summary */}
            <div>
              <Button
                variant={currentSection === "quick_summary" ? "default" : "ghost"}
                className={`w-full justify-start h-auto p-3 text-left ${
                  currentSection === "quick_summary"
                    ? "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"
                    : "hover:bg-[rgb(var(--muted))]"
                }`}
                onClick={() => handleItemClick("quick_summary", 0)}
              >
                <div className="flex items-center gap-3 w-full">
                  <BookOpen className="h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">Quick Summary</div>
                  </div>
                </div>
              </Button>
            </div>

            {/* Key Ideas */}
            {structuredSummary.key_ideas.length > 0 && (
              <div>
                <div className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-2 px-3">
                  Key Ideas
                </div>
                <div className="space-y-1">
                  {structuredSummary.key_ideas.map((idea, index) => (
                    <Button
                      key={index}
                      variant={currentSection === "key_ideas" && currentItemIndex === index ? "default" : "ghost"}
                      className={`w-full justify-start h-auto p-2 text-left text-sm ${
                        currentSection === "key_ideas" && currentItemIndex === index
                          ? "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"
                          : "hover:bg-[rgb(var(--muted))]"
                      }`}
                      onClick={() => handleItemClick("key_ideas", index)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Lightbulb className="h-3 w-3" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{idea.title}</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Chapters */}
            {normalChapters.length > 0 && (
              <div>
                <div className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-2 px-3">
                  Chapters
                </div>
                <div className="space-y-1">
                  {normalChapters.map(({ chapter, index }) => (
                    <Button
                      key={index}
                      variant={currentSection === "chapters" && currentItemIndex === index ? "default" : "ghost"}
                      className={`w-full justify-start h-auto p-2 text-left text-sm ${
                        currentSection === "chapters" && currentItemIndex === index
                          ? "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"
                          : "hover:bg-[rgb(var(--muted))]"
                      }`}
                      onClick={() => handleItemClick("chapters", index)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <List className="h-3 w-3" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{chapter.title}</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Full pasted summary (lossless) */}
            {fullPastedChapters.length > 0 && (
              <div>
                <div className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-2 px-3">
                  Full pasted summary
                </div>
                <div className="space-y-1">
                  {fullPastedChapters.map(({ chapter, index }) => (
                    <Button
                      key={index}
                      variant={currentSection === "chapters" && currentItemIndex === index ? "default" : "ghost"}
                      className={`w-full justify-start h-auto p-2 text-left text-sm ${
                        currentSection === "chapters" && currentItemIndex === index
                          ? "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"
                          : "hover:bg-[rgb(var(--muted))]"
                      }`}
                      onClick={() => handleItemClick("chapters", index)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <List className="h-3 w-3" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{chapter.title}</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Insights */}
            {summary.actionable_insights.length > 0 && (
              <div>
                <div className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-2 px-3">
                  Insights
                </div>
                <div className="space-y-1">
                  {summary.actionable_insights.map((insight, index) => (
                    <Button
                      key={index}
                      variant={currentSection === "actionable_insights" && currentItemIndex === index ? "default" : "ghost"}
                      className={`w-full justify-start h-auto p-2 text-left text-sm ${
                        currentSection === "actionable_insights" && currentItemIndex === index
                          ? "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"
                          : "hover:bg-[rgb(var(--muted))]"
                      }`}
                      onClick={() => handleItemClick("actionable_insights", index)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Target className="h-3 w-3" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">Insight {index + 1}</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Quotes */}
            {structuredSummary.quotes.length > 0 && (
              <div>
                <div className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-2 px-3">
                  Quotes
                </div>
                <div className="space-y-1">
                  {structuredSummary.quotes.map((quote, index) => (
                    <Button
                      key={index}
                      variant={currentSection === "quotes" && currentItemIndex === index ? "default" : "ghost"}
                      className={`w-full justify-start h-auto p-2 text-left text-sm ${
                        currentSection === "quotes" && currentItemIndex === index
                          ? "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"
                          : "hover:bg-[rgb(var(--muted))]"
                      }`}
                      onClick={() => handleItemClick("quotes", index)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Quote className="h-3 w-3" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">Quote {index + 1}</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}






