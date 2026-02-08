"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SummaryRatingProps = {
  bookId: string;
};

type RatingData = {
  id: string;
  rating: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
} | null;

// Mood info for each rating level
function getMoodEmoji(num: number): string {
  if (num <= 2) return "😫";
  if (num <= 3) return "😟";
  if (num <= 4) return "😐";
  if (num <= 5) return "🙂";
  if (num <= 6) return "😊";
  if (num <= 7) return "😄";
  if (num <= 8) return "🤩";
  if (num <= 9) return "🔥";
  return "💎";
}

export function SummaryRating({ bookId }: SummaryRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [currentRating, setCurrentRating] = useState<RatingData>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const loadRating = async () => {
      try {
        const meRes = await fetch("/api/me");
        const me = (await meRes.json().catch(() => ({}))) as { user?: unknown | null };
        if (!me?.user) {
          setIsLoggedIn(false);
          return;
        }
        setIsLoggedIn(true);

        const response = await fetch(`/api/books/${bookId}/rating`);
        if (response.ok) {
          const data = await response.json();
          if (data.rating) {
            setCurrentRating(data.rating);
            setRating(data.rating.rating);
            setNotes(data.rating.notes || "");
          }
        }
      } catch (error) {
        console.error("Error loading rating:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRating();
  }, [bookId]);

  const handleSubmit = async () => {
    if (rating === null) {
      setError("Please select a rating before submitting.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setShowSuccess(false);

    try {
      const response = await fetch(`/api/books/${bookId}/rating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating,
          notes: notes.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save rating.");
      }

      const data = await response.json();
      setCurrentRating(data.rating);
      setError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving rating:", err);
      setError(err instanceof Error ? err.message : "Failed to save rating.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return null; // Don't show loading state to keep the page clean
  }

  if (!isLoggedIn) {
    return null; // Don't show to logged-out users
  }

  const displayRating = hoveredRating ?? rating;

  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h3 className="text-xl sm:text-2xl font-bold">How was this summary?</h3>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Your feedback helps us improve our summaries
        </p>
      </div>

      {/* Emoji display */}
      <div className="flex justify-center">
        <span className="text-5xl sm:text-6xl transition-all duration-200" role="img" aria-label="mood">
          {displayRating ? getMoodEmoji(displayRating) : "🤔"}
        </span>
      </div>

      {/* Rating buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
            const isSelected = rating === num;
            const isHovered = hoveredRating === num;
            const shouldHighlight = isSelected || isHovered;

            return (
              <button
                key={num}
                type="button"
                onClick={() => setRating(num)}
                onMouseEnter={() => setHoveredRating(num)}
                onMouseLeave={() => setHoveredRating(null)}
                disabled={isSaving}
                className={`
                  w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 transition-all duration-150
                  ${shouldHighlight
                    ? "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] border-[rgb(var(--accent))] scale-110 shadow-md"
                    : "bg-[rgb(var(--muted))] border-[rgb(var(--border))] hover:border-[rgb(var(--accent))] hover:scale-105"
                  }
                  font-semibold text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {num}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-[rgb(var(--muted-foreground))] px-2">
          <span>Poor</span>
          <span>Excellent</span>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="rating-notes" className="text-sm">
          Notes (Optional)
        </Label>
        <Textarea
          id="rating-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you think of this summary?"
          disabled={isSaving}
          className="min-h-[80px] text-sm resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success */}
      {showSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50/60 p-3 text-sm text-green-700 text-center">
          Thank you for your rating!
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={isSaving || rating === null}
        className="w-full"
        size="lg"
      >
        {isSaving ? "Saving..." : currentRating ? "Update Rating" : "Submit Rating"}
      </Button>

      {/* Last updated info */}
      {currentRating && (
        <p className="text-xs text-center text-[rgb(var(--muted-foreground))]">
          You rated this {currentRating.rating}/10 on {new Date(currentRating.updated_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
