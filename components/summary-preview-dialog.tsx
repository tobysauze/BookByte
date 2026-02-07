"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import type { SummaryPayload } from "@/lib/schemas";
import { summarySchema } from "@/lib/schemas";

// Type guard for structured summaries
function isStructuredSummary(summary: SummaryPayload): summary is z.infer<typeof summarySchema> {
  return summary && typeof summary === 'object' && 'quick_summary' in summary && typeof (summary as Record<string, unknown>).quick_summary === 'string';
}

// Minimum word count target
const MIN_WORD_COUNT = 10000;

// Convert structured summary to continuous text format
function formatSummaryAsContinuousText(summary: SummaryPayload): string {
  // Ensure summary is structured
  if (!isStructuredSummary(summary)) {
    // For raw text summaries, return the raw text
    if ('raw_text' in summary && typeof (summary as { raw_text: string }).raw_text === 'string') {
      return (summary as { raw_text: string }).raw_text;
    }
    return "";
  }
  
  const structuredSummary = summary;
  const parts: string[] = [];
  
  // Short summary
  if (structuredSummary.short_summary) {
    parts.push(`SHORT SUMMARY\n${"=".repeat(50)}\n\n${structuredSummary.short_summary}\n\n`);
  }
  
  // Quick summary
  if (structuredSummary.quick_summary) {
    parts.push(`QUICK SUMMARY\n${"=".repeat(50)}\n\n${structuredSummary.quick_summary}\n\n`);
  }
  
  // Key ideas
  if (structuredSummary.key_ideas && structuredSummary.key_ideas.length > 0) {
    parts.push(`KEY IDEAS\n${"=".repeat(50)}\n\n`);
    structuredSummary.key_ideas.forEach((idea, index) => {
      parts.push(`${index + 1}. ${idea.title}\n\n${idea.text}\n\n`);
    });
  }
  
  // Chapters
  if (summary.chapters && summary.chapters.length > 0) {
    parts.push(`CHAPTERS\n${"=".repeat(50)}\n\n`);
    summary.chapters.forEach((chapter, index) => {
      parts.push(`Chapter ${index + 1}: ${chapter.title}\n\n${chapter.summary}\n\n`);
    });
  }
  
  // Actionable insights
  if (summary.actionable_insights && summary.actionable_insights.length > 0) {
    parts.push(`ACTIONABLE INSIGHTS\n${"=".repeat(50)}\n\n`);
    summary.actionable_insights.forEach((insight, index) => {
      parts.push(`${index + 1}. ${insight}\n\n`);
    });
  }
  
  // Quotes
  if (summary.quotes && summary.quotes.length > 0) {
    parts.push(`QUOTES\n${"=".repeat(50)}\n\n`);
    summary.quotes.forEach((quote, index) => {
      parts.push(`${index + 1}. "${quote}"\n\n`);
    });
  }
  
  // If summary has custom structure (not matching standard schema), include all fields
  const standardKeys = ['short_summary', 'quick_summary', 'key_ideas', 'chapters', 'actionable_insights', 'quotes', 'ai_provider'];
  const customKeys = Object.keys(summary).filter(key => !standardKeys.includes(key));
  
  if (customKeys.length > 0) {
    parts.push(`ADDITIONAL CONTENT\n${"=".repeat(50)}\n\n`);
    customKeys.forEach(key => {
      const value = (structuredSummary as Record<string, unknown>)[key];
      if (value !== undefined && value !== null) {
        parts.push(`${key.toUpperCase().replace(/_/g, ' ')}\n\n`);
        if (typeof value === 'string') {
          parts.push(`${value}\n\n`);
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'string') {
              parts.push(`${index + 1}. ${item}\n\n`);
            } else {
              parts.push(`${index + 1}. ${JSON.stringify(item, null, 2)}\n\n`);
            }
          });
        } else {
          parts.push(`${JSON.stringify(value, null, 2)}\n\n`);
        }
      }
    });
  }
  
  return parts.join('');
}

// Count words in a summary
function countSummaryWords(summary: SummaryPayload): number {
  let wordCount = 0;
  
  // Count words in quick_summary
  // Ensure summary is structured
  if (!isStructuredSummary(summary)) {
    // For raw text summaries, count words in raw_text
    if ('raw_text' in summary && typeof (summary as { raw_text: string }).raw_text === 'string') {
      return (summary as { raw_text: string }).raw_text.split(/\s+/).filter(word => word.length > 0).length;
    }
    return 0;
  }
  
  const structuredSummary = summary;
  
  if (structuredSummary.quick_summary) {
    wordCount += structuredSummary.quick_summary.split(/\s+/).filter(word => word.length > 0).length;
  }
  
  // Count words in key_ideas (title + text)
  if (structuredSummary.key_ideas) {
    structuredSummary.key_ideas.forEach(idea => {
      if (idea.title) {
        wordCount += idea.title.split(/\s+/).filter(word => word.length > 0).length;
      }
      if (idea.text) {
        wordCount += idea.text.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }
  
  // Count words in chapters (title + summary)
  if (structuredSummary.chapters) {
    structuredSummary.chapters.forEach(chapter => {
      if (chapter.title) {
        wordCount += chapter.title.split(/\s+/).filter(word => word.length > 0).length;
      }
      if (chapter.summary) {
        wordCount += chapter.summary.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }
  
  // Count words in actionable_insights
  if (structuredSummary.actionable_insights) {
    structuredSummary.actionable_insights.forEach(insight => {
      if (insight) {
        wordCount += insight.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }
  
  // Count words in quotes
  if (structuredSummary.quotes) {
    structuredSummary.quotes.forEach(quote => {
      if (quote) {
        wordCount += quote.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }
  
  // Count words in custom fields (for custom prompts)
  const standardKeys = ['short_summary', 'quick_summary', 'key_ideas', 'chapters', 'actionable_insights', 'quotes', 'ai_provider'];
  const customKeys = Object.keys(summary).filter(key => !standardKeys.includes(key));
  
  customKeys.forEach(key => {
    const value = (summary as Record<string, unknown>)[key];
    if (typeof value === 'string') {
      wordCount += value.split(/\s+/).filter(word => word.length > 0).length;
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'string') {
          wordCount += item.split(/\s+/).filter(word => word.length > 0).length;
        }
      });
    }
  });
  
  return wordCount;
}

type SummaryPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: SummaryPayload;
  metadata: {
    title: string;
    author?: string | null;
    coverUrl?: string | null;
  };
  onSave: () => void;
  onDiscard: () => void;
  isSaving?: boolean;
  isAutoSaved?: boolean;
  originalText?: string | null;
  title?: string;
  author?: string | null;
  onExpand?: (expandedSummary: SummaryPayload) => void;
};

export function SummaryPreviewDialog({
  open,
  onOpenChange,
  summary,
  metadata,
  onSave,
  onDiscard,
  isSaving = false,
  isAutoSaved = false,
  originalText,
  title,
  author,
  onExpand,
}: SummaryPreviewDialogProps) {
  // Check if this is raw text format (new format)
  const isRawText = summary && typeof summary === 'object' && 'raw_text' in summary && typeof (summary as Record<string, unknown>).raw_text === 'string';
  
  // If raw text, use it directly; otherwise format the structured summary
  const continuousText = isRawText 
    ? (summary as { raw_text: string }).raw_text
    : formatSummaryAsContinuousText(summary);
  
  // Word count: for raw text, count directly; otherwise use the function
  const wordCount = isRawText
    ? (continuousText.split(/\s+/).filter(word => word.length > 0).length)
    : countSummaryWords(summary);
  const needsExpansion = wordCount < MIN_WORD_COUNT;
  const [isExpanding, setIsExpanding] = useState(false);
  const [expansionError, setExpansionError] = useState<string | null>(null);
  const [showExpandDialog, setShowExpandDialog] = useState(false);
  const [targetWordCount, setTargetWordCount] = useState<string>(MIN_WORD_COUNT.toString());
  
  const handleExpandClick = () => {
    if (!originalText) {
      setExpansionError("Original book text is not available for expansion.");
      return;
    }
    setShowExpandDialog(true);
  };
  
  const handleExpand = async () => {
    if (!originalText) {
      setExpansionError("Original book text is not available for expansion.");
      return;
    }
    
    const targetCount = parseInt(targetWordCount, 10);
    if (isNaN(targetCount) || targetCount < wordCount) {
      setExpansionError(`Target word count must be a number greater than current count (${wordCount.toLocaleString()} words).`);
      return;
    }
    
    // Extract model from ai_provider if available
    // Format: "OpenRouter (anthropic/claude-sonnet-4.5)" -> "anthropic/claude-sonnet-4.5"
    let modelToUse: string | undefined = undefined;
    if (summary.ai_provider && typeof summary.ai_provider === 'string') {
      const match = summary.ai_provider.match(/OpenRouter\s*\(([^)]+)\)/);
      if (match && match[1]) {
        modelToUse = match[1].trim();
      }
    }
    
    setShowExpandDialog(false);
    setIsExpanding(true);
    setExpansionError(null);
    
    try {
      const response = await fetch("/api/summarize/expand", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary,
          originalText,
          title: title || metadata.title,
          author: author || metadata.author || undefined,
          targetWordCount: targetCount,
          model: modelToUse,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to expand summary");
      }
      
      const data = await response.json();
      if (data.summary && onExpand) {
        onExpand(data.summary);
      }
    } catch (error) {
      console.error("Error expanding summary:", error);
      setExpansionError(error instanceof Error ? error.message : "Failed to expand summary");
    } finally {
      setIsExpanding(false);
    }
  };
  
  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Review Summary</DialogTitle>
          <DialogDescription>
            Review the complete summary before {isAutoSaved ? "continuing" : "saving to your library"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Book Info */}
          <div className="mb-4 pb-4 border-b border-[rgb(var(--border))]">
            <h3 className="text-xl font-semibold">{metadata.title}</h3>
            {metadata.author && (
              <p className="text-sm text-[rgb(var(--muted-foreground))]">by {metadata.author}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {isStructuredSummary(summary) && summary.ai_provider && (
                <Badge className="bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]">
                  {summary.ai_provider}
                </Badge>
              )}
              <span className="text-xs font-semibold text-[rgb(var(--foreground))]">
                {wordCount.toLocaleString()} words
              </span>
              {needsExpansion && (
                <Badge variant="outline" className="text-xs text-yellow-600 dark:text-yellow-500 border-yellow-400">
                  Below 10,000 words ({MIN_WORD_COUNT - wordCount} words short)
                </Badge>
              )}
            </div>
            {expansionError && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800">
                {expansionError}
              </div>
            )}
          </div>

          {/* Full Text Display */}
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="prose prose-lg max-w-none dark:prose-invert">
              <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed text-[rgb(var(--foreground))] bg-[rgb(var(--muted))]/30 p-6 rounded-lg border border-[rgb(var(--border))]">
                {continuousText}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[rgb(var(--border))]">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onDiscard}
              disabled={isSaving || isExpanding}
            >
              {isAutoSaved ? "Close" : "Discard"}
            </Button>
            {(originalText) && (
              <Button
                variant="outline"
                onClick={handleExpandClick}
                disabled={isSaving || isExpanding}
                className="flex items-center gap-2"
              >
                {isExpanding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Expanding...
                  </>
                ) : (
                  "Expand Summary"
                )}
              </Button>
            )}
          </div>
          {!isAutoSaved && (
            <Button
              onClick={onSave}
              disabled={isSaving || isExpanding}
            >
              {isSaving ? "Saving..." : "Save to Library"}
            </Button>
          )}
          {isAutoSaved && (
            <Button
              onClick={() => onOpenChange(false)}
              disabled={isExpanding}
            >
              Continue
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
        
    {/* Expand Summary Dialog */}
    <Dialog open={showExpandDialog} onOpenChange={setShowExpandDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Target Word Count</DialogTitle>
          <DialogDescription>
            Enter the minimum word count you want for the expanded summary.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="target-word-count">Target Word Count</Label>
            <Input
              id="target-word-count"
              type="number"
              min={wordCount}
              value={targetWordCount}
              onChange={(e) => setTargetWordCount(e.target.value)}
              placeholder="10000"
            />
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Current: {wordCount.toLocaleString()} words. Target must be at least {wordCount.toLocaleString()} words.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowExpandDialog(false)}
            disabled={isExpanding}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExpand}
            disabled={isExpanding}
            className="flex items-center gap-2"
          >
            {isExpanding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Expanding...
              </>
            ) : (
              "Expand Summary"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

