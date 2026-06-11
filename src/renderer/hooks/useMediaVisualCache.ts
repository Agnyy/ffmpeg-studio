import { useCallback, useRef, useState } from "react";
import type { ProjectItem } from "../../shared/project";
import { generateWaveformPeaks, type WaveformPeak } from "../../media/audioWaveform";
import {
  generateTimelineThumbnails,
  type TimelineThumbnail,
} from "../../media/thumbnailGenerator";

export type ThumbnailCache = Record<string, TimelineThumbnail[]>;
export type WaveformCache = Record<string, WaveformPeak[]>;

type CacheEntry<T> = {
  status: "idle" | "loading" | "ready" | "error";
  data: T;
};

function buildThumbnailCacheKey(
  itemId: string,
  filePath: string,
  duration: number
): string {
  return `thumb:${itemId}:${filePath}:${Math.round(duration * 100)}`;
}

function buildWaveformCacheKey(filePath: string, duration: number): string {
  return `wave:${filePath}:${Math.round(duration * 100)}`;
}

export function useMediaVisualCache() {
  const thumbnailCacheRef = useRef<ThumbnailCache>({});
  const waveformCacheRef = useRef<WaveformCache>({});
  const failedThumbnailKeysRef = useRef(new Set<string>());
  const failedWaveformKeysRef = useRef(new Set<string>());
  const [thumbnailState, setThumbnailState] = useState<
    Record<string, CacheEntry<TimelineThumbnail[]>>
  >({});
  const [waveformState, setWaveformState] = useState<
    Record<string, CacheEntry<WaveformPeak[]>>
  >({});

  const invalidatePath = useCallback((filePath: string) => {
    for (const key of [...failedThumbnailKeysRef.current]) {
      if (key.includes(filePath)) {
        failedThumbnailKeysRef.current.delete(key);
      }
    }
    for (const key of [...failedWaveformKeysRef.current]) {
      if (key.includes(filePath)) {
        failedWaveformKeysRef.current.delete(key);
      }
    }
    for (const key of Object.keys(thumbnailCacheRef.current)) {
      if (key.includes(filePath)) {
        delete thumbnailCacheRef.current[key];
      }
    }
    for (const key of Object.keys(waveformCacheRef.current)) {
      if (key.includes(filePath)) {
        delete waveformCacheRef.current[key];
      }
    }
    setThumbnailState((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.includes(filePath)) {
          delete next[key];
        }
      }
      return next;
    });
    setWaveformState((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.includes(filePath)) {
          delete next[key];
        }
      }
      return next;
    });
  }, []);

  const requestThumbnails = useCallback(
    async (item: ProjectItem, duration: number, count: number) => {
      const inputPath = item.originalPath ?? item.path ?? "";
      if (!inputPath) {
        return;
      }
      const key = buildThumbnailCacheKey(item.id, inputPath, duration);
      if (failedThumbnailKeysRef.current.has(key)) {
        return;
      }
      if (thumbnailCacheRef.current[key]) {
        setThumbnailState((prev) => ({
          ...prev,
          [key]: { status: "ready", data: thumbnailCacheRef.current[key] },
        }));
        return;
      }

      setThumbnailState((prev) => ({
        ...prev,
        [key]: { status: "loading", data: [] },
      }));

      try {
        const thumbnails = await generateTimelineThumbnails(item, duration, {
          count,
          width: 96,
          height: 54,
        });
        thumbnailCacheRef.current[key] = thumbnails;
        setThumbnailState((prev) => ({
          ...prev,
          [key]: { status: "ready", data: thumbnails },
        }));
      } catch {
        failedThumbnailKeysRef.current.add(key);
        setThumbnailState((prev) => ({
          ...prev,
          [key]: { status: "error", data: [] },
        }));
      }
    },
    []
  );

  const requestWaveform = useCallback(
    async (filePath: string, fileUrl: string, duration: number, peakCount: number) => {
      const key = buildWaveformCacheKey(filePath, duration);
      if (failedWaveformKeysRef.current.has(key)) {
        return;
      }
      if (waveformCacheRef.current[key]) {
        setWaveformState((prev) => ({
          ...prev,
          [key]: { status: "ready", data: waveformCacheRef.current[key] },
        }));
        return;
      }

      setWaveformState((prev) => ({
        ...prev,
        [key]: { status: "loading", data: [] },
      }));

      try {
        const peaks = await generateWaveformPeaks(fileUrl, peakCount);
        waveformCacheRef.current[key] = peaks;
        setWaveformState((prev) => ({
          ...prev,
          [key]: { status: "ready", data: peaks },
        }));
      } catch {
        failedWaveformKeysRef.current.add(key);
        setWaveformState((prev) => ({
          ...prev,
          [key]: { status: "error", data: [] },
        }));
      }
    },
    []
  );

  const getThumbnailEntry = useCallback(
    (itemId: string, filePath: string, duration: number) => {
      const key = buildThumbnailCacheKey(itemId, filePath, duration);
      return thumbnailState[key] ?? { status: "idle" as const, data: [] };
    },
    [thumbnailState]
  );

  const getWaveformEntry = useCallback((filePath: string, duration: number) => {
    const key = buildWaveformCacheKey(filePath, duration);
    return waveformState[key] ?? { status: "idle" as const, data: [] };
  }, [waveformState]);

  return {
    requestThumbnails,
    requestWaveform,
    getThumbnailEntry,
    getWaveformEntry,
    invalidatePath,
    thumbnailCacheRef,
    waveformCacheRef,
  };
}
