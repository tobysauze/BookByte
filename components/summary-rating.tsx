"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

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

export function SummaryRating({ bookId }: SummaryRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [currentRating, setCurrentRating] = useState<RatingData>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRating = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

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
    } catch (err) {
      console.error("Error saving rating:", err);
      setError(err instanceof Error ? err.message : "Failed to save rating.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4">
        <div className="text-sm text-[rgb(var(--muted-foreground))]">Loading rating...</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Rate This Summary</Label>
        {currentRating && (
          <span className="text-xs text-[rgb(var(--muted-foreground))]">
            Last updated: {new Date(currentRating.updated_at).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Rating (1-10)</Label>
        <div className="flex items-center gap-2 flex-wrap">
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
                  w-10 h-10 rounded-lg border-2 transition-all
                  ${shouldHighlight
                    ? "bg-[rgb(var(--accent))] text-white border-[rgb(var(--accent))] scale-110"
                    : "bg-[rgb(var(--muted))] border-[rgb(var(--border))] hover:border-[rgb(var(--accent))]"
                  }
                  font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {num}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-[rgb(var(--muted-foreground))]">
          <span>Poor</span>
          <span>Excellent</span>
        </div>
      </div>

      {rating !== null && (
        <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/30 p-3">
          <p className="text-sm">
            Selected: <span className="font-semibold">{rating}/10</span>
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="rating-notes" className="text-sm">
          Notes (Optional)
        </Label>
        <Textarea
          id="rating-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this summary..."
          disabled={isSaving}
          className="min-h-[80px] text-sm"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={isSaving || rating === null}
        className="w-full"
        size="sm"
      >
        {isSaving ? "Saving..." : currentRating ? "Update Rating" : "Submit Rating"}
      </Button>
    </div>
  );
}

