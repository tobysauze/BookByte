"use client";

import Image from "next/image";
import Link from "next/link";
import { Bookmark, Headphones, Play } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteBookButton } from "@/components/delete-book-button";
import { SaveToLibraryButton } from "@/components/save-to-library-button";
import { LibraryActions } from "@/components/library-actions";
import { truncate } from "@/lib/utils";
import type { SupabaseSummary } from "@/lib/supabase";

type BookCardProps = {
  book: SupabaseSummary;
  showDeleteButton?: boolean;
  userRole?: string | null;
  isSavedToLibrary?: boolean;
  isRead?: boolean;
  isFavorited?: boolean;
  showLibraryActions?: boolean;
};

export function BookCard({ 
  book, 
  showDeleteButton = false, 
  userRole = null, 
  isSavedToLibrary = false,
  isRead = false,
  isFavorited = false,
  showLibraryActions = false
}: BookCardProps) {
  const {
    id,
    title,
    author,
    cover_url: coverUrl,
    summary,
    progress_percent: progressPercent,
  } = book;

  // Check if this is raw text format (new format)
  const isRawText = summary && typeof summary === 'object' && 'raw_text' in summary && typeof (summary as Record<string, unknown>).raw_text === 'string';
  const rawText = isRawText ? (summary as { raw_text: string }).raw_text : null;

  // Generate a category based on the book content or use a default
  const getCategory = () => {
    // Get text to analyze for category
    let textToAnalyze = '';
    if (isRawText && rawText) {
      // Use raw text (first 1000 chars for performance)
      textToAnalyze = rawText.substring(0, 1000).toLowerCase();
    } else if (summary.quick_summary && typeof summary.quick_summary === 'string') {
      textToAnalyze = summary.quick_summary.toLowerCase();
    } else {
      return 'NON-FICTION'; // Default if no text available
    }

    if (textToAnalyze.includes('psychology') || textToAnalyze.includes('mind') || textToAnalyze.includes('consciousness')) {
      return 'PSYCHOLOGY';
    }
    if (textToAnalyze.includes('leadership') || textToAnalyze.includes('management') || textToAnalyze.includes('business')) {
      return 'MANAGEMENT/LEADERSHIP';
    }
    if (textToAnalyze.includes('productivity') || textToAnalyze.includes('workflow')) {
      return 'PRODUCTIVITY';
    }
    if (textToAnalyze.includes('self-help') || textToAnalyze.includes('personal development')) {
      return 'SELF-HELP';
    }
    return 'NON-FICTION';
  };

  // Generate a subtle background color based on the book
  const getCardBackground = () => {
    const hash = title.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const colors = [
      'bg-slate-50',
      'bg-blue-50', 
      'bg-green-50',
      'bg-purple-50',
      'bg-pink-50',
      'bg-orange-50',
      'bg-yellow-50',
      'bg-indigo-50'
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  // Get display summary - prefer short_summary, then quick_summary, then first 200 chars of raw_text
  const getDisplaySummary = () => {
    if (summary.short_summary && typeof summary.short_summary === 'string') {
      return summary.short_summary;
    }
    if (summary.quick_summary && typeof summary.quick_summary === 'string') {
      return summary.quick_summary.substring(0, 200) + (summary.quick_summary.length > 200 ? '...' : '');
    }
    if (isRawText && rawText) {
      // For raw text, use first 200 characters
      return rawText.substring(0, 200) + (rawText.length > 200 ? '...' : '');
    }
    return 'No summary available.';
  };
  const displaySummary = getDisplaySummary();

  return (
    <Card className={`group relative overflow-hidden rounded-2xl border-0 shadow-sm transition-all duration-300 hover:shadow-lg ${getCardBackground()}`}>
      {/* Audio indicator */}
      <div className="absolute left-4 top-4 z-10">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
          <Headphones className="h-4 w-4 text-gray-600" />
        </div>
      </div>

      {/* Bookmark icon */}
      <div className="absolute right-4 top-4 z-10">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-full bg-white/80 p-0 shadow-sm hover:bg-white"
        >
          <Bookmark className="h-4 w-4 text-gray-600" />
        </Button>
      </div>

      <CardContent className="p-6">
        {/* Cover Image */}
        <div className="mb-6 flex justify-center">
          <div className="relative h-48 w-32 overflow-hidden rounded-xl shadow-lg">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={title}
                fill
                sizes="128px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                <div className="text-center text-white">
                  <div className="text-2xl font-bold">{title.charAt(0)}</div>
                  <div className="text-xs opacity-80">BOOK</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Category */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            {getCategory()}
          </span>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-lg font-bold leading-tight text-gray-900">
          {title}
        </h3>

        {/* Author and Short Summary */}
        <p className="mb-4 text-sm leading-relaxed text-gray-700">
          {author && `By ${author}. `}
          {displaySummary}
        </p>

        {/* Stats - Only show for structured format */}
        {!isRawText && (
          <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
            <span>
              {summary.key_ideas && Array.isArray(summary.key_ideas) ? summary.key_ideas.length : 0} key ideas
            </span>
            <span>
              {summary.chapters && Array.isArray(summary.chapters) ? summary.chapters.length : 0} chapters
            </span>
          </div>
        )}
        {isRawText && (
          <div className="mb-4 text-xs text-gray-500">
            <span>{rawText ? Math.ceil(rawText.split(/\s+/).filter(word => word.length > 0).length / 250) : 0} min read</span>
          </div>
        )}

        {/* Progress Bar */}
        {typeof progressPercent === "number" && progressPercent > 0 && (
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-gray-500">Progress</span>
              <span className="font-semibold text-gray-900">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button asChild className="flex-1 rounded-xl bg-gray-900 text-white hover:bg-gray-800">
              <Link href={`/books/${id}`} className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Continue Reading
              </Link>
            </Button>
            {showDeleteButton && userRole === "editor" && (
              <DeleteBookButton bookId={id} bookTitle={title} />
            )}
            {userRole === "regular" && book.is_public && !showLibraryActions && (
              <SaveToLibraryButton 
                bookId={id} 
                isSaved={isSavedToLibrary}
              />
            )}
          </div>
          
          {/* Library Actions for regular users */}
          {showLibraryActions && userRole === "regular" && (
            <LibraryActions
              bookId={id}
              bookTitle={title}
              isRead={isRead}
              isFavorited={isFavorited}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

