"use client";

import { useState, useEffect } from "react";

export type Highlight = {
  id: string;
  book_id: string;
  section: string;
  item_index: number;
  highlighted_text: string;
  context_text?: string;
  start_offset?: number;
  end_offset?: number;
  color?: string;
  created_at: string;
  books?: {
    id: string;
    title: string;
    author: string | null;
    cover_url: string | null;
  };
};

export function useHighlights(bookId?: string) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHighlights = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const url = bookId 
          ? `/api/highlights?bookId=${bookId}`
          : "/api/highlights";
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error("Failed to fetch highlights");
        }

        const data = await response.json();
        setHighlights(data.highlights || []);
      } catch (err) {
        console.error("Error fetching highlights:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHighlights();
  }, [bookId]);

  const refreshHighlights = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = bookId 
        ? `/api/highlights?bookId=${bookId}`
        : "/api/highlights";
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error("Failed to fetch highlights");
      }

      const data = await response.json();
      setHighlights(data.highlights || []);
    } catch (err) {
      console.error("Error fetching highlights:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return { highlights, isLoading, error, refreshHighlights };
}

