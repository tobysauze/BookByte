"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SummaryPayload } from "@/lib/schemas";

type PaginatedChaptersProps = {
  chapters: SummaryPayload["chapters"];
};

export function PaginatedChapters({ chapters }: PaginatedChaptersProps) {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  
  const currentChapter = chapters[currentChapterIndex];
  const totalChapters = chapters.length;
  const hasNext = currentChapterIndex < totalChapters - 1;
  const hasPrevious = currentChapterIndex > 0;

  const goToNext = () => {
    if (hasNext) {
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (hasPrevious) {
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  };

  const goToChapter = (index: number) => {
    if (index >= 0 && index < totalChapters) {
      setCurrentChapterIndex(index);
    }
  };

  if (totalChapters === 0) {
    return (
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8 text-center">
        <p className="text-[rgb(var(--muted-foreground))]">No chapters available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chapter Navigation Header */}
      <div className="text-center space-y-4">
        <h3 className="text-2xl font-bold">Chapter Summaries</h3>
        <div className="flex items-center justify-center gap-4">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {currentChapterIndex + 1} of {totalChapters}
          </Badge>
          
          {/* Chapter Selector */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
              disabled={!hasPrevious}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <select
              value={currentChapterIndex}
              onChange={(e) => goToChapter(parseInt(e.target.value))}
              className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
            >
              {chapters.map((_, index) => (
                <option key={index} value={index}>
                  Chapter {index + 1}
                </option>
              ))}
            </select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={!hasNext}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Current Chapter Content */}
      <article className="space-y-8 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8">
        {/* Chapter Header - Centered */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Badge className="text-sm px-3 py-1">Chapter {currentChapterIndex + 1}</Badge>
          </div>
          <h4 className="text-3xl font-bold text-center leading-tight">
            {currentChapter.title}
          </h4>
        </div>
        
        {/* Chapter Content - Large, Centered Text */}
        <div className="max-w-4xl mx-auto">
          <div className="text-lg leading-relaxed text-center text-[rgb(var(--foreground))] space-y-6">
            {currentChapter.summary.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-lg leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </article>

      {/* Navigation Footer */}
      <div className="flex items-center justify-center gap-6">
        <Button
          variant="outline"
          onClick={goToPrevious}
          disabled={!hasPrevious}
          className="flex items-center gap-2 px-6 py-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous Chapter
        </Button>
        
        <div className="text-sm text-[rgb(var(--muted-foreground))] px-4">
          Chapter {currentChapterIndex + 1} of {totalChapters}
        </div>
        
        <Button
          variant="outline"
          onClick={goToNext}
          disabled={!hasNext}
          className="flex items-center gap-2 px-6 py-2"
        >
          Next Chapter
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Chapter Progress Indicator */}
      <div className="space-y-3 text-center">
        <div className="text-sm text-[rgb(var(--muted-foreground))]">
          Progress: {Math.round(((currentChapterIndex + 1) / totalChapters) * 100)}%
        </div>
        <div className="max-w-md mx-auto">
          <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--muted))]">
            <div
              className="h-full rounded-full bg-[rgb(var(--accent))] transition-all duration-300"
              style={{ width: `${((currentChapterIndex + 1) / totalChapters) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
