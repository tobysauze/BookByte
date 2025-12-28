"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";

type AudioPlayerProps = {
  src: string;
  title: string;
  autoPlay?: boolean;
};

export function AudioPlayer({ src, title, autoPlay = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

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

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      await audio.play();
    }
  };

  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4">
      <audio key={src} ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={togglePlayback}>
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>{title}</span>
            <span className="text-xs text-[rgb(var(--muted-foreground))]">
              {formatDuration(progress)} / {formatDuration(duration)}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--muted))]/70">
            <div
              className="h-full rounded-full bg-[rgb(var(--accent))] transition-all"
              style={{ width: `${duration ? Math.min(100, (progress / duration) * 100) : 0}%` }}
            />
          </div>
        </div>
        <Volume2 className="hidden h-5 w-5 text-[rgb(var(--muted-foreground))] sm:block" />
      </div>
    </div>
  );
}

