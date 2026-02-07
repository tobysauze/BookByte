"use client";

import { EditableSummarySection, EditableTextSection, EditableListSection } from "@/components/editable-summary-section";
import { useHighlights } from "@/lib/use-highlights";
import { z } from "zod";
import type { SupabaseSummary } from "@/lib/supabase";
import type { SummaryPayload } from "@/lib/schemas";
import { summarySchema } from "@/lib/schemas";

// Type guard for structured summaries
function isStructuredSummary(summary: SummaryPayload): summary is z.infer<typeof summarySchema> {
  return summary && typeof summary === 'object' && 'quick_summary' in summary && typeof (summary as Record<string, unknown>).quick_summary === 'string';
}

type ContinuousScrollViewProps = {
  book: SupabaseSummary;
  canEdit?: boolean;
};

export function ContinuousScrollView({ book, canEdit = false }: ContinuousScrollViewProps) {
  const { highlights, refreshHighlights } = useHighlights(book.id);

  // Ensure summary is structured
  if (!isStructuredSummary(book.summary)) {
    return <div>Summary must be in structured format</div>;
  }
  
  const summary = book.summary;

  const handleSaveSection = async (section: string, data: any) => {
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
    }
  };

  const handleSaveText = async (section: string, content: string) => {
    await handleSaveSection(section, content);
  };

  const handleSaveItems = async (section: string, items: any[]) => {
    await handleSaveSection(section, items);
  };

  return (
    <div className="space-y-12 pb-12">
      {/* Quick Summary */}
      {summary.quick_summary && (
        <section id="quick-summary" className="scroll-mt-8">
          <EditableTextSection
            title="Quick Summary"
            content={summary.quick_summary}
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
        </section>
      )}

      {/* Key Ideas */}
      {summary.key_ideas && summary.key_ideas.length > 0 && (
        <section id="key-ideas" className="scroll-mt-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 pb-4 border-b border-[rgb(var(--border))]">
              Key Ideas
            </h2>
            <EditableSummarySection
              title=""
              items={summary.key_ideas.map((idea, index) => ({
                id: idea.title || `idea-${index}`,
                title: idea.title || "Key Idea",
                text: idea.text || ""
              }))}
              onSave={(items) => {
                const updatedIdeas = items.map(item => ({
                  title: item.title || "",
                  text: item.text || ""
                }));
                return handleSaveItems("key_ideas", updatedIdeas);
              }}
              canEdit={canEdit}
              className=""
              currentItemIndex={undefined}
              itemLabel="Key Idea"
              bookId={book.id}
              section="key_ideas"
              highlights={highlights}
              onHighlightCreated={refreshHighlights}
              onHighlightDeleted={refreshHighlights}
            />
          </div>
        </section>
      )}

      {/* Chapters */}
      {summary.chapters && summary.chapters.length > 0 && (
        <section id="chapters" className="scroll-mt-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 pb-4 border-b border-[rgb(var(--border))]">
              Chapters
            </h2>
            <EditableSummarySection
              title=""
              items={summary.chapters.map((chapter, index) => ({
                id: chapter.title || `chapter-${index}`,
                title: chapter.title || "Chapter",
                text: chapter.summary || ""
              }))}
              onSave={(items) => {
                const updatedChapters = items.map(item => ({
                  title: item.title || "",
                  summary: item.text || ""
                }));
                return handleSaveItems("chapters", updatedChapters);
              }}
              canEdit={canEdit}
              className=""
              currentItemIndex={undefined}
              itemLabel="Chapter"
              bookId={book.id}
              section="chapters"
              highlights={highlights}
              onHighlightCreated={refreshHighlights}
              onHighlightDeleted={refreshHighlights}
            />
          </div>
        </section>
      )}

      {/* Actionable Insights */}
      {summary.actionable_insights && summary.actionable_insights.length > 0 && (
        <section id="actionable-insights" className="scroll-mt-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 pb-4 border-b border-[rgb(var(--border))]">
              Actionable Insights
            </h2>
            <EditableListSection
              title=""
              items={summary.actionable_insights}
              onSave={(updatedItems) => handleSaveItems("actionable_insights", updatedItems)}
              canEdit={canEdit}
              className=""
              itemLabel="Insight"
              currentItemIndex={undefined}
              bookId={book.id}
              section="actionable_insights"
              highlights={highlights}
              onHighlightCreated={refreshHighlights}
              onHighlightDeleted={refreshHighlights}
            />
          </div>
        </section>
      )}

      {/* Quotes */}
      {summary.quotes && summary.quotes.length > 0 && (
        <section id="quotes" className="scroll-mt-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 pb-4 border-b border-[rgb(var(--border))]">
              Quotes
            </h2>
            <EditableListSection
              title=""
              items={summary.quotes}
              onSave={(updatedItems) => handleSaveItems("quotes", updatedItems)}
              canEdit={canEdit}
              className=""
              itemLabel="Quote"
              currentItemIndex={undefined}
              bookId={book.id}
              section="quotes"
              highlights={highlights}
              onHighlightCreated={refreshHighlights}
              onHighlightDeleted={refreshHighlights}
            />
          </div>
        </section>
      )}
    </div>
  );
}




