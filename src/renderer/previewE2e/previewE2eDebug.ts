import type { PreviewE2eDebugApi } from "./previewE2eWindow";

type PreviewE2eDebugSnapshot = PreviewE2eDebugApi;

let snapshot: PreviewE2eDebugSnapshot | null = null;

export function isPreviewE2eMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const queryFlag = new URLSearchParams(window.location.search).get("previewE2e") === "1";
  const selftestFlag = new URLSearchParams(window.location.search).get("previewSelftest") === "1";
  const crashTestFlag = new URLSearchParams(window.location.search).get("previewCrashTest") === "1";
  return (
    queryFlag ||
    selftestFlag ||
    crashTestFlag ||
    window.ffmpegStudio?.previewE2eEnabled === true ||
    window.ffmpegStudio?.previewSelftestEnabled === true ||
    window.ffmpegStudio?.previewCrashTestEnabled === true ||
    (window as Window & { __PREVIEW_E2E_MODE__?: boolean }).__PREVIEW_E2E_MODE__ === true
  );
}

export function shouldRegisterPreviewE2eDebug(): boolean {
  return (
    isPreviewE2eMode() ||
    window.ffmpegStudio?.previewE2eEnabled === true ||
    window.ffmpegStudio?.previewSelftestEnabled === true
  );
}

type PreviewAppDebugAugment = Pick<
  PreviewE2eDebugApi,
  "getCurrentTime" | "getProjectItemsCount" | "getTimelineLayersCount" | "getIsPlaying"
>;

let appAugment: PreviewAppDebugAugment | null = null;

function publishPreviewDebugApi(): void {
  if (!shouldRegisterPreviewE2eDebug()) {
    return;
  }
  (window as Window & { __PREVIEW_E2E_MODE__?: boolean }).__PREVIEW_E2E_MODE__ = true;
  window.__FFMPEG_STUDIO_PREVIEW_DEBUG__ = {
    getCanvasChecksum: () => snapshot?.getCanvasChecksum() ?? 0,
    getEngineState: () => snapshot?.getEngineState() ?? Promise.resolve(null),
    getDrawCount: () => snapshot?.getDrawCount() ?? 0,
    getPollCount: () => snapshot?.getPollCount?.() ?? 0,
    getLastDrawnTimeSec: () => snapshot?.getLastDrawnTimeSec?.() ?? null,
    getLastDrawnChecksum: () => snapshot?.getLastDrawnChecksum?.() ?? 0,
    getPreviewRuntimeDebug: () =>
      snapshot?.getPreviewRuntimeDebug?.() ??
      Promise.resolve({
        drawCount: snapshot?.getDrawCount() ?? 0,
        lastDrawnTimeSec: snapshot?.getLastDrawnTimeSec?.() ?? null,
        lastChecksum: snapshot?.getLastDrawnChecksum?.() ?? 0,
        pollCount: snapshot?.getPollCount?.() ?? 0,
        enginePlayheadSec: 0,
        engineIsPlaying: false,
        enginePhase: "unknown",
        queueDepth: 0,
        queueTimeRangeMin: null,
        queueTimeRangeMax: null,
        displayDrift: null,
        decodedFrames: 0,
      }),
    getLastError: () => snapshot?.getLastError() ?? "",
    getSessionReady: () => snapshot?.getSessionReady() ?? false,
    getEngineStatus: () => snapshot?.getEngineStatus() ?? "",
    getVisibleError: () => snapshot?.getVisibleError() ?? null,
    getCurrentTime: () => appAugment?.getCurrentTime?.() ?? 0,
    getProjectItemsCount: () => appAugment?.getProjectItemsCount?.() ?? 0,
    getTimelineLayersCount: () => appAugment?.getTimelineLayersCount?.() ?? 0,
    getIsPlaying: () => appAugment?.getIsPlaying?.() ?? false,
    getAudioDebug: () =>
      snapshot?.getAudioDebug?.() ?? {
        hasAudioElement: false,
        src: "",
        readyState: 0,
        paused: true,
        muted: false,
        currentTime: 0,
        duration: 0,
        errorCode: null,
        status: "idle",
        warning: null,
      },
  };
}

export function registerPreviewE2eDebug(next: PreviewE2eDebugSnapshot): void {
  snapshot = next;
  publishPreviewDebugApi();
}

export function augmentPreviewDebugApi(next: PreviewAppDebugAugment): void {
  appAugment = next;
  publishPreviewDebugApi();
}

export function unregisterPreviewE2eDebug(): void {
  snapshot = null;
  appAugment = null;
  if (isPreviewE2eMode()) {
    delete window.__FFMPEG_STUDIO_PREVIEW_DEBUG__;
  }
}

export function getPreviewE2eDebugSnapshot(): PreviewE2eDebugSnapshot | null {
  return snapshot;
}
