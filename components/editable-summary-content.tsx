"use client";

import { useState } from "react";

import { z } from "zod";
import { EditableSummarySection, EditableTextSection, EditableListSection } from "@/components/editable-summary-section";
import { UniversalPagination } from "@/components/universal-pagination";
import { useHighlights } from "@/lib/use-highlights";
import type { SupabaseSummary } from "@/lib/supabase";
import type { SummaryPayload } from "@/lib/schemas";
import { summarySchema } from "@/lib/schemas";

// Type guard for structured summaries
function isStructuredSummary(summary: SummaryPayload): summary is z.infer<typeof summarySchema> {
  return summary && typeof summary === 'object' && 'quick_summary' in summary && typeof (summary as Record<string, unknown>).quick_summary === 'string';
}

type EditableSummaryContentProps = {
  book: SupabaseSummary;
  activeTab: string;
  currentItemIndex: number;
  onSectionChange: (section: string) => void;
  onItemChange: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  canEdit?: boolean;
};

export function EditableSummaryContent({
  book,
  activeTab,
  currentItemIndex,
  onSectionChange,
  onItemChange,
  onPrevious,
  onNext,
  canEdit = false,
}: EditableSummaryContentProps) {
  // Ensure summary is structured
  if (!isStructuredSummary(book.summary)) {
    return <div>Summary must be in structured format</div>;
  }
  
  const [isUpdating, setIsUpdating] = useState(false);
  const { highlights, refreshHighlights } = useHighlights(book.id);

  // Ensure summary is structured
  if (!isStructuredSummary(book.summary)) {
    return <div>Summary must be in structured format</div>;
  }
  
  const summary = book.summary;

  const handleSaveSection = async (section: string, data: any) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/books/${book.id}/summary`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section,
          data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save changes");
      }

      // Refresh the page to show updated content
      window.location.reload();
    } catch (error) {
      console.error("Failed to save section:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveText = async (section: string, content: string) => {
    await handleSaveSection(section, content);
  };

  const handleSaveItems = async (section: string, items: any[]) => {
    await handleSaveSection(section, items);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "quick_summary":
        return (
          <EditableTextSection
            title="Quick Summary"
            content={summary.quick_summary || ""}
            onSave={(content) => handleSaveText("quick_summary", content)}
            canEdit={canEdit}
            className="max-w-4xl mx-auto"
            bookId={book.id}
            section="quick_summary"
            itemIndex={0}
            highlights={highlights}
            onHighlightCreated={refreshHighlights}
            onHighlightDeleted={refreshHighlights}
          />
        );

      case "key_ideas":
        const keyIdeas = summary.key_ideas || [];
        
        // Convert key ideas to EditableItem format
        const ideaItems = keyIdeas.map((idea, index) => ({
          id: idea.title || `idea-${index}`,
          title: idea.title || "Key Idea",
          text: idea.text || ""
        }));
        
        return (
          <EditableSummarySection
            title="Key Ideas"
            items={ideaItems}
            onSave={(items) => {
              const updatedIdeas = items.map(item => ({
                title: item.title || "",
                text: item.text || ""
              }));
              return handleSaveItems("key_ideas", updatedIdeas);
            }}
            canEdit={canEdit}
            className="max-w-4xl mx-auto"
            currentItemIndex={currentItemIndex}
            itemLabel="Key Idea"
            bookId={book.id}
            section="key_ideas"
            highlights={highlights}
            onHighlightCreated={refreshHighlights}
            onHighlightDeleted={refreshHighlights}
          />
        );

      case "chapters":
        const chapters = summary.chapters || [];
        
        // Convert chapters to EditableItem format
        const chapterItems = chapters.map((chapter, index) => ({
          id: chapter.title || `chapter-${index}`,
          title: chapter.title || "Chapter",
          text: chapter.summary || ""
        }));
        
        return (
          <EditableSummarySection
            title="Chapters"
            items={chapterItems}
            onSave={(items) => {
              const updatedChapters = items.map(item => ({
                title: item.title || "",
                summary: item.text || ""
              }));
              return handleSaveItems("chapters", updatedChapters);
            }}
            canEdit={canEdit}
            className="max-w-4xl mx-auto"
            currentItemIndex={currentItemIndex}
            itemLabel="Chapter"
            bookId={book.id}
            section="chapters"
            highlights={highlights}
            onHighlightCreated={refreshHighlights}
            onHighlightDeleted={refreshHighlights}
          />
        );

      case "actionable_insights":
        const insights = summary.actionable_insights || [];
        
        // Use EditableListSection which shows all insights when editing, or current one when viewing
        return (
          <EditableListSection
            title="Actionable Insights"
            items={insights}
            onSave={(updatedItems) => handleSaveItems("actionable_insights", updatedItems)}
            canEdit={canEdit}
            className="max-w-4xl mx-auto"
            itemLabel="Insight"
            currentItemIndex={currentItemIndex}
            bookId={book.id}
            section="actionable_insights"
            highlights={highlights}
            onHighlightCreated={refreshHighlights}
            onHighlightDeleted={refreshHighlights}
          />
        );

      case "quotes":
        const quotes = summary.quotes || [];
        
        // Use EditableListSection to show multiple quotes per page
        return (
          <EditableListSection
            title="Quotes"
            items={quotes}
            onSave={(updatedItems) => handleSaveItems("quotes", updatedItems)}
            canEdit={canEdit}
            className="max-w-4xl mx-auto"
            itemLabel="Quote"
            currentItemIndex={currentItemIndex}
            bookId={book.id}
            section="quotes"
            highlights={highlights}
            onHighlightCreated={refreshHighlights}
            onHighlightDeleted={refreshHighlights}
          />
        );

      default:
        return <div>Unknown section</div>;
    }
  };

  const getTotalItems = () => {
    switch (activeTab) {
      case "quick_summary":
        return 1;
      case "key_ideas":
        return summary.key_ideas?.length || 0;
      case "chapters":
        return summary.chapters?.length || 0;
      case "actionable_insights":
        return summary.actionable_insights?.length || 0;
      case "quotes":
        return summary.quotes?.length || 0;
      default:
        return 0;
    }
  };

  const totalItems = getTotalItems();

  return (
    <div className="space-y-8">
      {/* Top pagination */}
      {totalItems > 1 && (
        <UniversalPagination
          summary={summary}
          currentSection={activeTab as keyof SummaryPayload}
          currentItemIndex={currentItemIndex}
          totalItems={totalItems}
          onPrevious={onPrevious}
          onNext={onNext}
          onItemChange={onItemChange}
        />
      )}

      {/* Content */}
      <div className="min-h-[400px]">
        {renderContent()}
      </div>

      {/* Bottom pagination */}
      {totalItems > 1 && (
        <UniversalPagination
          summary={summary}
          currentSection={activeTab as keyof SummaryPayload}
          currentItemIndex={currentItemIndex}
          totalItems={totalItems}
          onPrevious={onPrevious}
          onNext={onNext}
          onItemChange={onItemChange}
        />
      )}

      {/* Loading indicator */}
      {isUpdating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span>Saving changes...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

