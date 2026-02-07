"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bookmark, Headphones, Play, Pencil, Check, X } from "lucide-react";

import { Input } from "@/components/ui/input";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteBookButton } from "@/components/delete-book-button";
import { SaveToLibraryButton } from "@/components/save-to-library-button";
import { LibraryActions } from "@/components/library-actions";
import type { SupabaseSummary } from "@/lib/supabase";
import { AudioPlayer } from "@/components/audio-player";
import { SpeechSynthesisPlayer } from "@/components/speech-synthesis-player";
import { toast } from "sonner";

type BookCardProps = {
  book: SupabaseSummary;
  showDeleteButton?: boolean;
  userRole?: string | null;
  isSavedToLibrary?: boolean;
  isRead?: boolean;
  isFavorited?: boolean;
  showLibraryActions?: boolean;
};

const CATEGORIES = [
  "Arts / Design",
  "Biography / Memoir",
  "Business",
  "Career / Success",
  "Communication",
  "Economics",
  "Education",
  "Entertainment",
  "Entrepreneurship",
  "Fiction",
  "Food",
  "Health",
  "History",
  "Law",
  "Lifestyle",
  "Management / Leadership",
  "Marketing",
  "Media",
  "Money / Finance",
  "Motivation",
  "Parenting",
  "Philosophy",
  "Politics",
  "Productivity",
  "Psychology",
  "Relationships",
  "Sales",
  "Science",
  "Self-Improvement",
  "Society / Culture",
  "Spirituality",
  "Sports",
  "Technology"
];

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
    word_count: wordCount,
    description,
    category
  } = book;

  // Check if this is raw text format (new format)
  // Note: summary might be undefined if we optimised the query to exclude it
  const hasSummary = !!summary;
  const isRawText = hasSummary && typeof summary === 'object' && 'raw_text' in summary && typeof (summary as Record<string, unknown>).raw_text === 'string';
  const rawText = isRawText ? (summary as { raw_text: string }).raw_text : null;
  const isStructuredSummary = hasSummary && typeof summary === 'object' && 'quick_summary' in summary && typeof (summary as Record<string, unknown>).quick_summary === 'string';

  // Generate a category based on the book content or use a default
  const getCategory = () => {
    if (category) return category;

    // Get text to analyze for category
    let textToAnalyze = '';
    if (isRawText && rawText) {
      // Use raw text (first 1000 chars for performance)
      textToAnalyze = rawText.substring(0, 1000).toLowerCase();
    } else if (isStructuredSummary && (summary as { quick_summary: string }).quick_summary) {
      textToAnalyze = (summary as { quick_summary: string }).quick_summary.toLowerCase();
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
    const toSentenceBlurb = (text: string) => {
      const cleaned = text
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (!cleaned) return "";
      const firstPara = cleaned.split(/\n{2,}/g)[0]?.trim() ?? cleaned;
      const sentences = firstPara
        .split(/(?<=[.!?])\s+/g)
        .map((s) => s.trim())
        .filter(Boolean);
      return sentences.slice(0, 3).join(" ");
    };

    // If description exists but starts with deep-dive headings, clean it up.
    if (description) {
      const desc = description.trim();
      if (/^part\s+\d+\s*:/i.test(desc) || desc.includes("ONE-PAGE EXECUTIVE SUMMARY")) {
        return toSentenceBlurb(desc);
      }
      return desc;
    }

    if (isStructuredSummary) {
      const structured = summary as { short_summary?: string; quick_summary?: string };
      if (structured.short_summary && typeof structured.short_summary === 'string') {
        return structured.short_summary;
      }
      if (structured.quick_summary && typeof structured.quick_summary === 'string') {
        return toSentenceBlurb(structured.quick_summary);
      }
    }
    if (isRawText && rawText) {
      return toSentenceBlurb(rawText);
    }
    return 'No summary available.';
  };

  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [optimisticCategory, setOptimisticCategory] = useState<string | null>(null);

  const currentCategory = optimisticCategory || getCategory();

  const handleSaveCategory = async () => {
    if (!newCategory.trim()) {
      setIsEditingCategory(false);
      return;
    }

    const originalCategory = currentCategory;

    // Optimistic update
    setOptimisticCategory(newCategory);
    setIsEditingCategory(false);

    try {
      const response = await fetch(`/api/books/${id}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory }),
      });

      if (!response.ok) {
        throw new Error("Failed to update category");
      }

      toast.success("Category updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update category");
      // Revert optimistic update
      setOptimisticCategory(null);
    }
  };

  const startEditing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setNewCategory(currentCategory);
    setIsEditingCategory(true);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditingCategory(false);
    setNewCategory("");
  };

  const saveEditing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void handleSaveCategory();
  };

  const displaySummary = getDisplaySummary();

  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const handleListen = async () => {
    try {
      setIsGeneratingAudio(true);
      setFallbackText(null);
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: id, section: "full_summary" }),
      });

      if (!response.ok) {
        const msg = await response.text().catch(() => "");
        throw new Error(msg || "Failed to generate audio");
      }

      const data = (await response.json()) as {
        audioUrl: string | null;
        cached?: boolean;
        fallback?: "speechSynthesis";
        fallbackText?: string;
      };

      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setIsPlayerOpen(true);
        toast.success(data.cached ? "Audio ready (cached)" : "Audio ready");
        return;
      }

      if (data.fallback === "speechSynthesis" && typeof data.fallbackText === "string") {
        // Show a fallback player with pause/resume + next/prev chunk controls.
        setAudioUrl(null);
        setFallbackText(data.fallbackText);
        setIsPlayerOpen(true);
        toast.message("Using device text-to-speech (fallback)");
        return;
      }

      throw new Error("Failed to generate audio.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to generate audio");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  return (
    <Card className={`group relative overflow-hidden rounded-2xl border-0 shadow-sm transition-all duration-300 hover:shadow-lg ${getCardBackground()}`}>
      {/* Audio indicator */}
      <div className="absolute left-4 top-4 z-10">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleListen();
          }}
          disabled={isGeneratingAudio}
          className="h-8 w-8 rounded-full bg-white shadow-sm hover:bg-white/90 p-0"
          title="Listen"
        >
          <Headphones className="h-4 w-4 text-gray-600" />
        </Button>
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
        <div className="mb-2 flex items-center justify-between h-8">
          {isEditingCategory ? (
            <div className="flex items-center gap-2 w-full" onClick={(e) => e.preventDefault()}>
              <Select
                value={newCategory}
                onValueChange={setNewCategory}
              >
                <SelectTrigger className="h-7 text-xs py-1 px-2 w-full" onClick={(e) => e.stopPropagation()}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent onClick={(e) => e.stopPropagation()}>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={saveEditing}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={cancelEditing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {currentCategory}
              </span>
              {userRole === "editor" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={startEditing}
                  title="Edit Category"
                >
                  <Pencil className="h-3 w-3 text-gray-400 hover:text-gray-700" />
                </Button>
              )}
            </div>
          )}
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
        {!isRawText && isStructuredSummary && (
          <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
            <span>
              {(summary as { key_ideas?: unknown[] }).key_ideas && Array.isArray((summary as { key_ideas: unknown[] }).key_ideas)
                ? (summary as { key_ideas: unknown[] }).key_ideas.length
                : 0} key ideas
            </span>
            <span>
              {(summary as { chapters?: unknown[] }).chapters && Array.isArray((summary as { chapters: unknown[] }).chapters)
                ? (summary as { chapters: unknown[] }).chapters.length
                : 0} chapters
            </span>
          </div>
        )}
        {(wordCount !== undefined && wordCount !== null) && (
          <div className="mb-4 text-xs text-gray-500">
            <span>{Math.ceil(wordCount / 250)} min read</span>
          </div>
        )}
        {!wordCount && isRawText && (
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
            {showDeleteButton && (
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

      <Dialog open={isPlayerOpen} onOpenChange={setIsPlayerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Narration</DialogTitle>
          </DialogHeader>
          {audioUrl ? (
            <AudioPlayer src={audioUrl} title="Full summary narration" autoPlay />
          ) : fallbackText ? (
            <SpeechSynthesisPlayer text={fallbackText} autoPlay />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

