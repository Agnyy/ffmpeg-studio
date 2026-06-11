import type { PreviewEngineStateResult } from "../../preview-engine/ipcTypes";

export type PreviewRuntimeDebug = {
  drawCount: number;
  lastDrawnTimeSec: number | null;
  lastChecksum: number;
  pollCount: number;
  enginePlayheadSec: number;
  engineIsPlaying: boolean;
  enginePhase: string;
  queueDepth: number;
  queueTimeRangeMin: number | null;
  queueTimeRangeMax: number | null;
  displayDrift: number | null;
  decodedFrames: number;
};

export type PreviewAudioDebug = {
  hasAudioElement: boolean;
  src: string;
  readyState: number;
  paused: boolean;
  muted: boolean;
  currentTime: number;
  duration: number;
  errorCode: number | null;
  status: string;
  warning: string | null;
};

export type PreviewE2eDebugApi = {
  getCanvasChecksum: () => number;
  getEngineState: () => Promise<PreviewEngineStateResult | null>;
  getDrawCount: () => number;
  getPollCount?: () => number;
  getLastDrawnTimeSec: () => number | null;
  getLastDrawnChecksum: () => number;
  getPreviewRuntimeDebug: () => Promise<PreviewRuntimeDebug>;
  getLastError: () => string;
  getSessionReady: () => boolean;
  getEngineStatus: () => string;
  getVisibleError: () => string | null;
  getCurrentTime?: () => number;
  getProjectItemsCount?: () => number;
  getTimelineLayersCount?: () => number;
  getIsPlaying?: () => boolean;
  getAudioDebug?: () => PreviewAudioDebug;
};

declare global {
  interface Window {
    __FFMPEG_STUDIO_PREVIEW_DEBUG__?: PreviewE2eDebugApi;
  }
}

export {};
