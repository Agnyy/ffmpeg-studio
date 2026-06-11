import type { PreviewSyncMode } from "../utils/previewPlayback";

export type PlaybackDiagnostics = {
  syncMode: PreviewSyncMode;
  compCurrentTime: number;
  videoCurrentTime: number | null;
  masterLayerId: string | null;
  audibleLayerId: string | null;
  driftSeconds: number | null;
  playbackRate: number;
  isPlaying: boolean;
  useCachePlayback: boolean;
};

export const EMPTY_PLAYBACK_DIAGNOSTICS: PlaybackDiagnostics = {
  syncMode: "composition-clock",
  compCurrentTime: 0,
  videoCurrentTime: null,
  masterLayerId: null,
  audibleLayerId: null,
  driftSeconds: null,
  playbackRate: 1,
  isPlaying: false,
  useCachePlayback: false,
};
