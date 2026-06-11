import type { TimelineLayer } from "./project";

export type PreviewCacheStatus = "none" | "valid" | "caching" | "stale" | "failed";

export type PreviewCacheState = {
  cacheId: string;
  path: string | null;
  startTime: number;
  endTime: number;
  status: PreviewCacheStatus;
  fingerprint: string;
  error?: string;
};

export const EMPTY_PREVIEW_CACHE: PreviewCacheState = {
  cacheId: "",
  path: null,
  startTime: 0,
  endTime: 0,
  status: "none",
  fingerprint: "",
};

export function computePreviewCacheFingerprint(
  layers: TimelineLayer[],
  compWidth: number,
  compHeight: number,
  fps: number
): string {
  const payload = {
    compWidth,
    compHeight,
    fps,
    layers: layers.map((layer) => ({
      id: layer.id,
      index: layer.index,
      startTime: layer.startTime,
      inPoint: layer.inPoint,
      outPoint: layer.outPoint,
      enabled: layer.enabled,
      transform: layer.transform,
      cropEnabled: layer.cropEnabled,
      crop: layer.crop,
      effects: layer.effects,
      keyframes: layer.keyframes,
    })),
  };
  return JSON.stringify(payload);
}

export function isPreviewCachePlayable(cache: PreviewCacheState): boolean {
  return cache.status === "valid" && Boolean(cache.path) && cache.endTime > cache.startTime;
}
