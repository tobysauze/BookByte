"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";

type AudioPlayerProps = {
  src: string;
  title: string;
  autoPlay?: boolean;
};

export function AudioPlayer({ src, title, autoPlay = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setProgress(audio.currentTime || 0);
    };
    const onTimeUpdate = () => {
      setProgress(audio.currentTime || 0);
    };
    const onEnd = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    if (autoPlay) {
      void audio.play();
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [autoPlay, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    audio.load();
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      await audio.play();
    }
  };

  const seekTo = (timeSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!Number.isFinite(duration) || duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(timeSeconds, duration));
  };

  const skip = (deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    seekTo((audio.currentTime || 0) + deltaSeconds);
  };

  const cycleRate = () => {
    const rates = [1, 1.25, 1.5, 1.75, 2] as const;
    const idx = rates.indexOf(playbackRate as (typeof rates)[number]);
    const next = rates[(idx + 1) % rates.length] ?? 1;
    setPlaybackRate(next);
  };

  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4">
      <audio key={src} ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={togglePlayback} aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>{title}</span>
            <span className="text-xs text-[rgb(var(--muted-foreground))]">
              {formatDuration(progress)} / {formatDuration(duration)}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {/* Seek bar (click + drag) */}
            <div
              ref={progressBarRef}
              className="h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--muted))]/70 cursor-pointer"
              onClick={(e) => {
                const el = progressBarRef.current;
                if (!el || !duration) return;
                const rect = el.getBoundingClientRect();
                const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
                const ratio = rect.width ? x / rect.width : 0;
                seekTo(ratio * duration);
              }}
              title="Click to seek"
            >
              <div
                className="h-full rounded-full bg-[rgb(var(--accent))] transition-all"
                style={{ width: `${duration ? Math.min(100, (progress / duration) * 100) : 0}%` }}
              />
            </div>

            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={progress}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full"
              aria-label="Seek"
              disabled={!duration}
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => skip(-15)}
                  disabled={!duration}
                  title="Rewind 15s"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  -15s
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => skip(15)}
                  disabled={!duration}
                  title="Forward 15s"
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  +15s
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cycleRate}
                title="Playback speed"
              >
                {playbackRate}x
              </Button>
            </div>
          </div>
        </div>
        <Volume2 className="hidden h-5 w-5 text-[rgb(var(--muted-foreground))] sm:block" />
      </div>
    </div>
  );
}

