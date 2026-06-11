export type PreviewBackend = "chromium-video" | "node-av";

export type PreviewMetadata = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  pixelFormat: string;
  codec: string;
};

export type PreviewOpenResult = {
  ok: boolean;
  metadata?: PreviewMetadata;
  error?: string;
};

export type PreviewSeekResult = {
  ok: boolean;
  error?: string;
};

export type PreviewFrameResult = {
  ok: boolean;
  width: number;
  height: number;
  /** RGBA pixel data (width * height * 4), when available */
  rgba?: Uint8Array;
  /** PNG data URL fallback for canvas draw */
  dataUrl?: string;
  /** Wall-clock time of the returned frame (legacy alias for actualTimeSec). */
  sourceTimeSec: number;
  requestedTimeSec?: number;
  actualTimeSec?: number;
  usedFallback?: boolean;
  error?: string;
};

export type PreviewCloseResult = {
  ok: boolean;
  error?: string;
};
