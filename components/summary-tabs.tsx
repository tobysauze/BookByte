"use client";

import { useEffect, useState } from "react";

import { AudioPlayer } from "@/components/audio-player";
import { Badge } from "@/components/ui/badge";
import { PaginatedChapters } from "@/components/paginated-chapters";
import { UniversalPagination } from "@/components/universal-pagination";
import type { SummaryPayload } from "@/lib/schemas";

type SummarySectionKey = keyof SummaryPayload;

type SummaryContentProps = {
  summary: SummaryPayload;
  activeTab: SummarySectionKey;
  currentItemIndex: number;
  onSectionChange: (section: SummarySectionKey) => void;
  onItemChange: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  audioUrlBySection?: Partial<Record<SummarySectionKey, string>>;
  onGenerateAudio?: (section: SummarySectionKey) => Promise<string | void> | string | void;
  isGenerating?: boolean;
};

const sectionLabels: Record<SummarySectionKey, string> = {
  quick_summary: "Quick Summary",
  key_ideas: "Key Ideas",
  chapters: "Chapters",
  actionable_insights: "Insights",
  quotes: "Quotes",
};

const EMPTY_AUDIO_MAP = {};

export function SummaryContent({
  summary,
  activeTab,
  currentItemIndex,
  onSectionChange,
  onItemChange,
  onPrevious,
  onNext,
  audioUrlBySection = EMPTY_AUDIO_MAP,
  onGenerateAudio,
  isGenerating,
}: SummaryContentProps) {
  const [localAudioMap, setLocalAudioMap] = useState(audioUrlBySection);

  useEffect(() => {
    setLocalAudioMap(audioUrlBySection);
  }, [audioUrlBySection]);

  const handleGenerateAudio = async (section: SummarySectionKey) => {
    if (!onGenerateAudio) return;
    const maybeUrl = await onGenerateAudio(section);
    if (typeof maybeUrl === "string") {
      setLocalAudioMap((prev) => ({ ...prev, [section]: maybeUrl }));
    }
  };

  const currentAudio = localAudioMap[activeTab];

  // Check if this is raw text format (new format)
  const isRawText = summary && typeof summary === 'object' && 'raw_text' in summary && typeof (summary as Record<string, unknown>).raw_text === 'string';
  const rawText = isRawText ? (summary as { raw_text: string }).raw_text : null;

  const renderContent = () => {
    // If raw text format, display it directly
    if (isRawText && rawText) {
      return (
        <section className="space-y-8">
          <div className="text-center">
            <h3 className="text-3xl font-bold">Summary</h3>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-lg max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap font-sans text-base leading-relaxed text-[rgb(var(--foreground))] bg-[rgb(var(--muted))]/30 p-6 rounded-lg border border-[rgb(var(--border))]">
                {rawText}
              </div>
            </div>
          </div>
        </section>
      );
    }

    // Structured format rendering
    switch (activeTab) {
      case "quick_summary":
        if (!summary.quick_summary || typeof summary.quick_summary !== 'string') {
          return (
            <section className="space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-bold">Quick Summary</h3>
              </div>
              <div className="max-w-4xl mx-auto">
                <div className="text-center text-[rgb(var(--muted-foreground))]">
                  Quick summary not available.
                </div>
              </div>
            </section>
          );
        }
        return (
          <section className="space-y-8">
            <div className="text-center">
              <h3 className="text-3xl font-bold">Quick Summary</h3>
            </div>
            <div className="max-w-4xl mx-auto">
              <div className="text-lg leading-relaxed text-center text-[rgb(var(--foreground))] space-y-6">
                {summary.quick_summary.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-lg leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </section>
        );

      case "key_ideas":
        if (!summary.key_ideas || !Array.isArray(summary.key_ideas)) {
          return (
            <section className="space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-bold">Key Ideas</h3>
              </div>
              <div className="max-w-4xl mx-auto">
                <div className="text-center text-[rgb(var(--muted-foreground))]">
                  Key ideas not available.
                </div>
              </div>
            </section>
          );
        }
        const currentIdea = summary.key_ideas[currentItemIndex];
        if (!currentIdea) {
          return (
            <section className="space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-bold">Key Ideas</h3>
              </div>
              <div className="max-w-4xl mx-auto">
                <div className="text-center text-[rgb(var(--muted-foreground))]">
                  No key idea available at this position.
                </div>
              </div>
            </section>
          );
        }
        return (
          <section className="space-y-8">
            <div className="text-center">
              <h3 className="text-3xl font-bold">Key Ideas</h3>
            </div>
            <div className="max-w-4xl mx-auto">
              <div className="space-y-6 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <Badge className="text-sm px-3 py-1">Idea {currentItemIndex + 1}</Badge>
                  </div>
                  <h4 className="text-2xl font-bold">{currentIdea.title}</h4>
                </div>
                <div className="text-lg leading-relaxed text-center text-[rgb(var(--foreground))]">
                  {currentIdea.text.split('\n\n').map((paragraph, pIndex) => (
                    <p key={pIndex} className="text-lg leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );

      case "chapters":
        if (!summary.chapters || !Array.isArray(summary.chapters)) {
          return (
            <section className="space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-bold">Chapter Summaries</h3>
              </div>
              <div className="max-w-4xl mx-auto">
                <div className="text-center text-[rgb(var(--muted-foreground))]">
                  Chapters not available.
                </div>
              </div>
            </section>
          );
        }
        console.log('Rendering chapters - currentItemIndex:', currentItemIndex, 'chapters length:', summary.chapters.length);
        const currentChapter = summary.chapters[currentItemIndex];
        console.log('Current chapter:', currentChapter);
        console.log('Chapter keys:', currentChapter ? Object.keys(currentChapter) : 'undefined');
        console.log('Chapter content:', currentChapter?.content);
        
        if (!currentChapter) {
          // If no chapter at this index, show a message or return to first chapter
          return (
            <section className="space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-bold">Chapter Summaries</h3>
              </div>
              <div className="max-w-4xl mx-auto">
                <div className="text-center text-[rgb(var(--muted-foreground))]">
                  No chapter available at this position.
                </div>
              </div>
            </section>
          );
        }
        
        // Check if chapter has content property - try different possible property names
        const chapterContent = currentChapter.content || currentChapter.text || currentChapter.summary || currentChapter.body;
        if (!chapterContent || typeof chapterContent !== 'string') {
          console.log('Chapter exists but no valid content property found. Available keys:', Object.keys(currentChapter));
          console.log('Content type:', typeof chapterContent, 'Content value:', chapterContent);
          return (
            <section className="space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-bold">Chapter Summaries</h3>
              </div>
              <div className="max-w-4xl mx-auto">
                <div className="text-center text-[rgb(var(--muted-foreground))]">
                  Chapter content is not available.
                </div>
              </div>
            </section>
          );
        }
        return (
          <section className="space-y-8">
            <div className="text-center">
              <h3 className="text-3xl font-bold">Chapter Summaries</h3>
            </div>
            <div className="max-w-4xl mx-auto">
              <div className="space-y-6 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <Badge className="text-sm px-3 py-1">Chapter {currentItemIndex + 1}</Badge>
                  </div>
                  <h4 className="text-2xl font-bold">{currentChapter.title}</h4>
                </div>
                <div className="text-lg leading-relaxed text-center text-[rgb(var(--foreground))]">
                  {chapterContent.split('\n\n').map((paragraph, pIndex) => (
                    <p key={pIndex} className="text-lg leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );

      case "actionable_insights":
        if (!summary.actionable_insights || !Array.isArray(summary.actionable_insights)) {
          return (
            <section className="space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-bold">Actionable Insights</h3>
              </div>
              <div className="max-w-4xl mx-auto">
                <div className="text-center text-[rgb(var(--muted-foreground))]">
                  Actionable insights not available.
                </div>
              </div>
            </section>
          );
        }
        const currentInsight = summary.actionable_insights[currentItemIndex];
        if (!currentInsight) {
          return (
            <section className="space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-bold">Actionable Insights</h3>
              </div>
              <div className="max-w-4xl mx-auto">
                <div className="text-center text-[rgb(var(--muted-foreground))]">
                  No insight available at this position.
                </div>
              </div>
            </section>
          );
        }
        return (
          <section className="space-y-8">
            <div className="text-center">
              <h3 className="text-3xl font-bold">Actionable Insights</h3>
            </div>
            <div className="max-w-4xl mx-auto">
              <div className="space-y-6 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <Badge className="text-sm px-3 py-1">Insight {currentItemIndex + 1}</Badge>
                  </div>
                  <div className="text-lg leading-relaxed text-center text-[rgb(var(--foreground))]">
                    {currentInsight.split('\n\n').map((paragraph, pIndex) => (
                      <p key={pIndex} className="text-lg leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        );

      case "quotes":
        if (!summary.quotes || !Array.isArray(summary.quotes)) {
          return (
            <section className="space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-bold">Quote Bank</h3>
              </div>
              <div className="max-w-4xl mx-auto">
                <div className="text-center text-[rgb(var(--muted-foreground))]">
                  Quotes not available.
                </div>
              </div>
            </section>
          );
        }
        const currentQuote = summary.quotes[currentItemIndex];
        if (!currentQuote) {
          return (
            <section className="space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-bold">Quote Bank</h3>
              </div>
              <div className="max-w-4xl mx-auto">
                <div className="text-center text-[rgb(var(--muted-foreground))]">
                  No quote available at this position.
                </div>
              </div>
            </section>
          );
        }
        return (
          <section className="space-y-8">
            <div className="text-center">
              <h3 className="text-3xl font-bold">Quote Bank</h3>
            </div>
            <div className="max-w-4xl mx-auto">
              <div className="space-y-6 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <Badge className="text-sm px-3 py-1">Quote {currentItemIndex + 1}</Badge>
                  </div>
                  <blockquote className="text-xl leading-relaxed text-center text-[rgb(var(--foreground))] italic">
                    "{currentQuote}"
                  </blockquote>
                </div>
              </div>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Universal Pagination - Top */}
      <UniversalPagination
        summary={summary}
        currentSection={activeTab}
        currentItemIndex={currentItemIndex}
        onSectionChange={onSectionChange}
        onItemChange={onItemChange}
        onPrevious={onPrevious}
        onNext={onNext}
      />
      
      {renderContent()}
      
      {/* Universal Pagination - Bottom */}
      <UniversalPagination
        summary={summary}
        currentSection={activeTab}
        currentItemIndex={currentItemIndex}
        onSectionChange={onSectionChange}
        onItemChange={onItemChange}
        onPrevious={onPrevious}
        onNext={onNext}
      />
      
      {currentAudio ? (
        <AudioPlayer src={currentAudio} title={`${sectionLabels[activeTab]} audio`} />
      ) : null}
    </div>
  );
}

