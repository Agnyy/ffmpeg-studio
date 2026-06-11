export type PreviewEnginePhase =
  | "idle"
  | "opening"
  | "paused"
  | "playing"
  | "seeking"
  | "buffering"
  | "error";

export type PreviewEngineMetadata = {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  pixelFormat: string;
  codec: string;
};

export type QueuedVideoFrame = {
  sequence: number;
  timeSec: number;
  width: number;
  height: number;
  decodeMs: number;
  rgba: Uint8Array;
};

export type PlayerRunMetrics = {
  file: string;
  metadata: PreviewEngineMetadata | null;
  decodedFrames: number;
  displayedFrames: number;
  droppedFrames: number;
  queueOverflowDrops: number;
  displayUnderruns: number;
  decodeMsTotal: number;
  decodeMsMax: number;
  queueDepthSum: number;
  queueDepthSamples: number;
  queueDepthMax: number;
  seekCount: number;
  demuxerReopenCount: number;
  playbackWallSec: number;
  sequentialDecodeOk: boolean;
  errors: string[];
};

export type PlayerTestReport = {
  metrics: PlayerRunMetrics;
  tests: {
    play30s: boolean;
    seekForward5s: boolean;
    seekBackward5s: boolean;
    pauseResume: boolean;
  };
};
