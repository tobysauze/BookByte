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
  /** Timestamp of last save (ms since epoch) */
  savedAt?: number;
};

function storageKey(bookId: string) {
  return `reading-pos-${bookId}`;
}

// ---------------------------------------------------------------------------
// localStorage (fast cache)
// ---------------------------------------------------------------------------

export function saveReadingPosition(bookId: string, position: ReadingPosition) {
  try {
    localStorage.setItem(
      storageKey(bookId),
      JSON.stringify({ ...position, savedAt: Date.now() }),
    );
  } catch {
    // Storage full or unavailable
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

// ---------------------------------------------------------------------------
// Database sync (cross-device)
// ---------------------------------------------------------------------------

async function fetchPositionFromDb(
  bookId: string,
): Promise<{ position: ReadingPosition | null; updatedAt: string | null }> {
  try {
    const res = await fetch(`/api/reading-position/${encodeURIComponent(bookId)}`);
    if (!res.ok) return { position: null, updatedAt: null };
    const data = await res.json();
    return {
      position: data.position ?? null,
      updatedAt: data.updatedAt ?? null,
    };
  } catch {
    return { position: null, updatedAt: null };
  }
}

async function savePositionToDb(bookId: string, position: ReadingPosition) {
  try {
    await fetch(`/api/reading-position/${encodeURIComponent(bookId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position }),
    });
  } catch {
    // Best-effort — localStorage still has the data
  }
}

/**
 * Returns the best reading position by comparing localStorage (fast) with
 * the database (cross-device). Uses whichever is newer.
 */
export function useDbReadingPosition(
  bookId: string,
  onPositionLoaded: (pos: ReadingPosition) => void,
) {
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const localPos = loadReadingPosition(bookId);

    fetchPositionFromDb(bookId).then(({ position: dbPos, updatedAt }) => {
      if (!dbPos) return; // nothing in DB, localStorage already applied at init

      const dbTime = updatedAt ? new Date(updatedAt).getTime() : 0;
      const localTime = localPos?.savedAt ?? 0;

      if (dbTime > localTime) {
        // DB is newer (from another device) — apply it
        saveReadingPosition(bookId, { ...dbPos, savedAt: dbTime });
        onPositionLoaded(dbPos);
      }
    });
  }, [bookId, onPositionLoaded]);
}

// ---------------------------------------------------------------------------
// Debounced DB saver — batches rapid saves into one API call
// ---------------------------------------------------------------------------

const DB_SAVE_DEBOUNCE_MS = 2000;
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function debouncedSaveToDb(bookId: string, position: ReadingPosition) {
  // Always save to localStorage immediately
  saveReadingPosition(bookId, position);

  // Debounce the DB write
  const existing = pendingTimers.get(bookId);
  if (existing) clearTimeout(existing);

  pendingTimers.set(
    bookId,
    setTimeout(() => {
      pendingTimers.delete(bookId);
      savePositionToDb(bookId, { ...position, savedAt: Date.now() });
    }, DB_SAVE_DEBOUNCE_MS),
  );
}

/** Flush any pending DB save immediately (call on unmount / beforeunload). */
function flushPendingDbSave(bookId: string, position: ReadingPosition) {
  const existing = pendingTimers.get(bookId);
  if (existing) {
    clearTimeout(existing);
    pendingTimers.delete(bookId);
  }
  // Use sendBeacon for reliability during page unload
  try {
    const url = `/api/reading-position/${encodeURIComponent(bookId)}`;
    const body = JSON.stringify({ position: { ...position, savedAt: Date.now() } });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      // Fallback — fire-and-forget fetch
      fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch {
    // Best-effort
  }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Tracks scroll percentage and calls `onScroll` with debounced values.
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

    setTimeout(() => tryRestore(0), 150);
  }, [shouldRestore, percent]);
}

/**
 * Saves position on beforeunload and visibilitychange, to both
 * localStorage and the database (via sendBeacon).
 */
export function useSaveOnExit(bookId: string, getPosition: () => ReadingPosition) {
  const getPositionRef = useRef(getPosition);
  getPositionRef.current = getPosition;

  const save = useCallback(() => {
    const pos = getPositionRef.current();
    saveReadingPosition(bookId, pos);
    flushPendingDbSave(bookId, pos);
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
