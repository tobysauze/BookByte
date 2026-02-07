"use client";

import * as React from "react";

import { BookOpen, Lightbulb, List, Target, Quote, Headphones, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { z } from "zod";
import type { SummaryPayload } from "@/lib/schemas";
import { summarySchema } from "@/lib/schemas";

// Only use structured summary keys (not raw_text variant)
type SummarySectionKey = keyof z.infer<typeof summarySchema>;
type NarrationSectionKey = SummarySectionKey | "full_summary";

type VerticalSummaryNavProps = {
  summary: SummaryPayload;
  activeTab: SummarySectionKey;
  onTabChange: (tab: SummarySectionKey) => void;
  onGenerateAudio?: (section: NarrationSectionKey) => Promise<string | void> | string | void;
  isGenerating?: boolean;
  onContentsClick?: () => void;
};

const sectionOrder: SummarySectionKey[] = [
  "quick_summary",
  "short_summary",
  "key_ideas",
  "chapters",
  "actionable_insights",
  "quotes",
];

const sectionLabels: Record<SummarySectionKey, string> = {
  quick_summary: "Quick Summary",
  short_summary: "Short Summary",
  key_ideas: "Key Ideas",
  chapters: "Chapters",
  actionable_insights: "Insights",
  quotes: "Quotes",
  ai_provider: "AI Provider",
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

// Type guard for structured summaries
function isStructuredSummary(summary: SummaryPayload): summary is z.infer<typeof summarySchema> {
  return summary && typeof summary === 'object' && 'quick_summary' in summary && typeof (summary as Record<string, unknown>).quick_summary === 'string';
}

export function VerticalSummaryNav({
  summary,
  activeTab,
  onTabChange,
  onGenerateAudio,
  isGenerating,
  onContentsClick,
}: VerticalSummaryNavProps) {
  // Ensure summary is structured
  if (!isStructuredSummary(summary)) {
    return null; // Don't show nav for raw text summaries
  }

  const structuredSummary = summary;

  const [isCollapsed, setIsCollapsed] = React.useState(false);

  React.useEffect(() => {
    // Auto-collapse on small screens
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      className={`sticky left-0 top-24 z-40 h-[calc(100vh-6rem)] border-r border-[rgb(var(--border))] bg-[rgb(var(--background))] transition-all duration-300 ease-in-out ${isCollapsed ? "w-12" : "w-64"
        }`}
    >
      <div className="flex flex-col h-full">
        {/* Collapse Toggle */}
        <div className="flex justify-end p-2 border-b border-[rgb(var(--border))]">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <Menu className="h-4 w-4" /> : <Menu className="h-4 w-4 rotate-90" />}
          </Button>
        </div>

        <div className="p-3 space-y-2 flex-1 overflow-y-auto">
          {/* Contents Button - Hide when collapsed */}
          {!isCollapsed && onContentsClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onContentsClick}
              className="w-full mb-4"
            >
              <Menu className="h-4 w-4 mr-2" />
              Contents
            </Button>
          )}

          {/* Navigation Items */}
          <nav className="space-y-2">
            {sectionOrder.map((section) => {
              const isActive = activeTab === section;
              const Icon = sectionIcons[section];
              const label = sectionLabels[section];

              // Get count for each section
              let count = 0;
              if (section === "key_ideas") count = structuredSummary.key_ideas.length;
              else if (section === "chapters") count = structuredSummary.chapters.length;
              else if (section === "actionable_insights") count = structuredSummary.actionable_insights.length;
              else if (section === "quotes") count = structuredSummary.quotes.length;

              return (
                <Button
                  key={section}
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full justify-start h-auto p-2 text-left ${isActive
                    ? "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"
                    : "hover:bg-[rgb(var(--muted))]"
                    } ${isCollapsed ? "justify-center px-0" : ""}`}
                  onClick={() => onTabChange(section)}
                  title={label}
                >
                  <div className={`flex items-center gap-2 ${isCollapsed ? "justify-center" : "w-full"}`}>
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs truncate">{label}</div>
                        {count > 0 && (
                          <div className="text-xs opacity-70 mt-0.5">
                            {count}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Button>
              );
            })}
          </nav>

          {/* Listen Button */}
          {onGenerateAudio && !isCollapsed && (
            <div className="mt-8 pt-6 border-t border-[rgb(var(--border))]">
              <Button
                variant="secondary"
                size="sm"
                disabled={Boolean(isGenerating)}
                onClick={() => onGenerateAudio("full_summary")}
                className="w-full"
              >
                <Headphones className="h-4 w-4 mr-2" />
                {isGenerating ? "Generating…" : "Listen"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
