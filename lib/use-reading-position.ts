"use client";

import { useCallback, useEffect, useRef } from "react";

export type ReadingPosition = {
  /** For structured paginated: section key (e.g. "chapters") */
  section?: string;
  /** For structured paginated: item index within the section */
  itemIndex?: number;
  /** For raw text paginated: page index */
  page?: number;
  /** For continuous scroll modes: percentage through the page (0-100) */
  scrollPercent?: number;
  /** Which view mode was active */
  viewMode?: string;
  /** Timestamp of last save */
  savedAt?: number;
};

function storageKey(bookId: string) {
  return `reading-pos-${bookId}`;
}

export function saveReadingPosition(bookId: string, position: ReadingPosition) {
  try {
    localStorage.setItem(
      storageKey(bookId),
      JSON.stringify({ ...position, savedAt: Date.now() }),
    );
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function loadReadingPosition(bookId: string): ReadingPosition | null {
  try {
    const raw = localStorage.getItem(storageKey(bookId));
    if (!raw) return null;
    return JSON.parse(raw) as ReadingPosition;
  } catch {
    return null;
  }
}

/**
 * Tracks scroll percentage and calls `onScroll` with debounced values.
 * Attach to a component that uses window-level scrolling.
 */
export function useScrollPositionTracker(
  enabled: boolean,
  onScroll: (percent: number) => void,
  debounceMs = 500,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handler = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight <= 0) return;
        const percent = Math.min(100, Math.round((scrollTop / docHeight) * 100));
        onScroll(percent);
      }, debounceMs);
    };

    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, onScroll, debounceMs]);
}

/**
 * Restores scroll position (percentage) after a short delay to let content render.
 */
export function useRestoreScrollPercent(
  shouldRestore: boolean,
  percent: number | undefined,
) {
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!shouldRestore || percent == null || restoredRef.current) return;
    restoredRef.current = true;

    const tryRestore = (attempt: number) => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0 && attempt < 10) {
        setTimeout(() => tryRestore(attempt + 1), 100);
        return;
      }
      const targetY = (percent / 100) * docHeight;
      window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
    };

    // Wait for content to render, then restore
    setTimeout(() => tryRestore(0), 150);
  }, [shouldRestore, percent]);
}

/**
 * Saves position on beforeunload (browser/tab close) and visibilitychange (app switch on mobile).
 */
export function useSaveOnExit(bookId: string, getPosition: () => ReadingPosition) {
  const getPositionRef = useRef(getPosition);
  getPositionRef.current = getPosition;

  const save = useCallback(() => {
    saveReadingPosition(bookId, getPositionRef.current());
  }, [bookId]);

  useEffect(() => {
    const handleBeforeUnload = () => save();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") save();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      save();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [save]);
}
