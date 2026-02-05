"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, Square } from "lucide-react";

import { Button } from "@/components/ui/button";

function splitIntoChunks(text: string, maxChars: number) {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const paras = cleaned.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    const c = current.trim();
    if (c) chunks.push(c);
    current = "";
  };

  for (const para of paras) {
    if (!current) {
      if (para.length <= maxChars) {
        current = para;
        continue;
      }
      // Split long paragraph by sentences; hard-slice if needed.
      const sentences = para.split(/(?<=[.!?])\s+/g);
      let buf = "";
      for (const s of sentences) {
        if (!buf) {
          if (s.length <= maxChars) buf = s;
          else {
            for (let i = 0; i < s.length; i += maxChars) {
              chunks.push(s.slice(i, i + maxChars).trim());
            }
          }
          continue;
        }

        if (buf.length + 1 + s.length <= maxChars) buf = `${buf} ${s}`;
        else {
          chunks.push(buf.trim());
          buf = s;
        }
      }
      if (buf.trim()) chunks.push(buf.trim());
      continue;
    }

    if (current.length + 2 + para.length <= maxChars) current = `${current}\n\n${para}`;
    else {
      push();
      current = para;
    }
  }

  push();
  return chunks;
}

type SpeechSynthesisPlayerProps = {
  text: string;
  title?: string;
  autoPlay?: boolean;
};

export function SpeechSynthesisPlayer({
  text,
  title = "Device narration (fallback)",
  autoPlay = false,
}: SpeechSynthesisPlayerProps) {
  const chunks = useMemo(() => splitIntoChunks(text, 900), [text]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1);

  const canUse =
    typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

  const stop = () => {
    if (!canUse) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    utteranceRef.current = null;
  };

  const speakAt = (index: number) => {
    if (!canUse) return;
    const safe = Math.max(0, Math.min(index, Math.max(0, chunks.length - 1)));
    const chunk = chunks[safe] ?? "";
    if (!chunk) return;

    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(chunk);
    u.rate = rate;
    u.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    u.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      // Auto-advance.
      if (safe < chunks.length - 1) {
        setChunkIndex(safe + 1);
      }
    };
    u.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utteranceRef.current = u;
    setChunkIndex(safe);
    window.speechSynthesis.speak(u);
  };

  useEffect(() => {
    // Reset when text changes.
    stop();
    setChunkIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    if (!autoPlay) return;
    if (!canUse) return;
    if (chunks.length === 0) return;
    speakAt(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  useEffect(() => {
    // Cleanup on unmount.
    return () => {
      if (!canUse) return;
      window.speechSynthesis.cancel();
    };
  }, [canUse]);

  useEffect(() => {
    const u = utteranceRef.current;
    if (u) u.rate = rate;
  }, [rate]);

  const toggle = () => {
    if (!canUse) return;
    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }
    if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }
    speakAt(chunkIndex);
  };

  const skip = (delta: number) => {
    speakAt(chunkIndex + delta);
  };

  const cycleRate = () => {
    const rates = [1, 1.25, 1.5, 1.75, 2] as const;
    const idx = rates.indexOf(rate as (typeof rates)[number]);
    const next = rates[(idx + 1) % rates.length] ?? 1;
    setRate(next);
  };

  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{title}</div>
          <div className="text-xs text-[rgb(var(--muted-foreground))]">
            {chunks.length ? `Part ${chunkIndex + 1} / ${chunks.length}` : "No text available"}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={cycleRate} title="Playback speed">
          {rate}x
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => skip(-1)}
          disabled={!canUse || chunks.length <= 1}
          title="Previous"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Prev
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggle}
          disabled={!canUse || chunks.length === 0}
          aria-label={isSpeaking && !isPaused ? "Pause" : "Play"}
          title={isSpeaking && !isPaused ? "Pause" : "Play"}
        >
          {isSpeaking && !isPaused ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={stop}
          disabled={!canUse}
          aria-label="Stop"
          title="Stop"
        >
          <Square className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => skip(1)}
          disabled={!canUse || chunks.length <= 1}
          title="Next"
        >
          Next
          <RotateCw className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {!canUse ? (
        <div className="mt-3 text-xs text-red-600">This browser does not support device text-to-speech.</div>
      ) : null}
    </div>
  );
}

