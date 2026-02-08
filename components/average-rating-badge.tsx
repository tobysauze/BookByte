"use client";

import { useState, useEffect } from "react";

type AverageRatingBadgeProps = {
  bookId: string;
};

// Mood faces based on rating (1-10 scale)
function getMoodInfo(rating: number): { emoji: string; label: string; color: string } {
  if (rating <= 2) return { emoji: "😫", label: "Poor", color: "text-red-500" };
  if (rating <= 3) return { emoji: "😟", label: "Below Average", color: "text-red-400" };
  if (rating <= 4) return { emoji: "😐", label: "Average", color: "text-orange-400" };
  if (rating <= 5) return { emoji: "🙂", label: "Decent", color: "text-yellow-500" };
  if (rating <= 6) return { emoji: "😊", label: "Good", color: "text-yellow-400" };
  if (rating <= 7) return { emoji: "😄", label: "Very Good", color: "text-green-400" };
  if (rating <= 8) return { emoji: "🤩", label: "Excellent", color: "text-green-500" };
  if (rating <= 9) return { emoji: "🔥", label: "Outstanding", color: "text-emerald-500" };
  return { emoji: "💎", label: "Masterpiece", color: "text-emerald-400" };
}

export function AverageRatingBadge({ bookId }: AverageRatingBadgeProps) {
  const [average, setAverage] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAverage = async () => {
      try {
        const res = await fetch(`/api/books/${bookId}/rating/average`);
        if (res.ok) {
          const data = await res.json();
          setAverage(data.average);
          setCount(data.count);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    };
    fetchAverage();
  }, [bookId]);

  if (isLoading || average === null) return null;

  const mood = getMoodInfo(average);

  return (
    <div className="flex items-center justify-center">
      <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-sm">
        {/* Mood emoji */}
        <span className="text-3xl" role="img" aria-label={mood.label}>
          {mood.emoji}
        </span>
        
        {/* Rating number */}
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-0.5">
            <span className={`text-2xl font-bold ${mood.color}`}>
              {average}
            </span>
            <span className="text-sm text-[rgb(var(--muted-foreground))]">/10</span>
          </div>
          <span className="text-xs text-[rgb(var(--muted-foreground))]">
            {count} {count === 1 ? "rating" : "ratings"}
          </span>
        </div>

        {/* Label */}
        <span className={`text-sm font-medium ${mood.color}`}>
          {mood.label}
        </span>
      </div>
    </div>
  );
}
