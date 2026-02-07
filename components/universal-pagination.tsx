"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import type { SummaryPayload } from "@/lib/schemas";
import { summarySchema } from "@/lib/schemas";

// Only use structured summary keys (not raw_text variant)
type SummarySectionKey = keyof z.infer<typeof summarySchema>;

// Type guard for structured summaries
function isStructuredSummary(summary: SummaryPayload): summary is z.infer<typeof summarySchema> {
  return summary && typeof summary === 'object' && 'quick_summary' in summary && typeof (summary as Record<string, unknown>).quick_summary === 'string';
}

type UniversalPaginationProps = {
  summary?: SummaryPayload;
  currentSection?: SummarySectionKey;
  currentItemIndex: number;
  totalItems?: number;
  onSectionChange?: (section: SummarySectionKey) => void;
  onItemChange: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
};

export function UniversalPagination({
  summary,
  currentSection,
  currentItemIndex,
  totalItems,
  onSectionChange,
  onItemChange,
  onPrevious,
  onNext,
}: UniversalPaginationProps) {
  // Calculate total items across all sections (if summary provided)
  const getTotalItemsFromSummary = () => {
    if (!summary) return totalItems;
    
    // Ensure summary is structured
    if (!isStructuredSummary(summary)) {
      return totalItems || 0;
    }
    
    return (
      1 + // Quick Summary
      (summary.key_ideas?.length || 0) +
      (summary.chapters?.length || 0) +
      (summary.actionable_insights?.length || 0) +
      (summary.quotes?.length || 0)
    );
  };

  // Items per page for pagination
  const ITEMS_PER_PAGE = 5;

  // Calculate current page and total pages
  const getCurrentPageInfo = () => {
    if (!summary || !currentSection) {
      const page = Math.floor(currentItemIndex / ITEMS_PER_PAGE) + 1;
      const totalPages = Math.ceil((totalItems || 1) / ITEMS_PER_PAGE);
      return { currentPage: page, totalPages };
    }
    
    // Ensure summary is structured
    if (!isStructuredSummary(summary)) {
      const page = Math.floor(currentItemIndex / ITEMS_PER_PAGE) + 1;
      const totalPages = Math.ceil((totalItems || 1) / ITEMS_PER_PAGE);
      return { currentPage: page, totalPages };
    }
    
    let itemsBeforeSection = 0;
    
    if (currentSection === "quick_summary") {
      return { currentPage: 1, totalPages: 1 };
    }
    
    itemsBeforeSection += 1; // Quick Summary
    
    let sectionItems = 0;
    if (currentSection === "key_ideas") {
      sectionItems = summary.key_ideas?.length || 0;
    } else {
      itemsBeforeSection += summary.key_ideas?.length || 0;
      
      if (currentSection === "chapters") {
        sectionItems = summary.chapters?.length || 0;
      } else {
        itemsBeforeSection += summary.chapters?.length || 0;
        
        if (currentSection === "actionable_insights") {
          sectionItems = summary.actionable_insights?.length || 0;
        } else {
          itemsBeforeSection += summary.actionable_insights?.length || 0;
          
          if (currentSection === "quotes") {
            sectionItems = summary.quotes?.length || 0;
          }
        }
      }
    }
    
    const sectionPage = Math.floor(currentItemIndex / ITEMS_PER_PAGE) + 1;
    const sectionTotalPages = Math.ceil(sectionItems / ITEMS_PER_PAGE);
    const pagesBeforeSection = Math.ceil(itemsBeforeSection / ITEMS_PER_PAGE);
    
    return {
      currentPage: pagesBeforeSection + sectionPage,
      totalPages: pagesBeforeSection + sectionTotalPages,
      sectionCurrentPage: sectionPage,
      sectionTotalPages: sectionTotalPages,
    };
  };

  const pageInfo = getCurrentPageInfo();
  const calculatedTotalItems = summary ? getTotalItemsFromSummary() : (totalItems || 1);

  // Check if we're on first/last page
  const isFirstPage = pageInfo.currentPage === 1;
  const isLastPage = pageInfo.currentPage === pageInfo.totalPages;

  return (
    <div className="flex items-center justify-center space-x-4 py-6">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevious}
        disabled={isFirstPage}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous Page
      </Button>
      
      <div className="flex items-center space-x-2">
        <span className="text-sm text-[rgb(var(--muted-foreground))]">
          Page {pageInfo.currentPage} of {pageInfo.totalPages}
        </span>
        {pageInfo.sectionCurrentPage && (
          <span className="text-xs text-[rgb(var(--muted-foreground))] opacity-70">
            ({pageInfo.sectionCurrentPage}/{pageInfo.sectionTotalPages} in section)
          </span>
        )}
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={isLastPage}
        className="flex items-center gap-2"
      >
        Next Page
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

