import type { PreviewBufferedRange } from "../shared/previewBufferedRanges";
import type { PreviewEngineMetadata, PreviewEnginePhase } from "./types";

export type PreviewEngineOpenResult = {
  ok: boolean;
  metadata?: PreviewEngineMetadata;
  hasCurrentFrame?: boolean;
  initialFrame?: PreviewEngineFrameResult;
  error?: string;
};

export type PreviewEngineCloseResult = {
  ok: boolean;
  error?: string;
};

export type PreviewEngineSeekResult = {
  ok: boolean;
  playheadSec?: number;
  frame?: PreviewEngineFrameResult;
  warning?: string;
  error?: string;
};

export type PreviewEngineStateResult = {
  ok: boolean;
  playheadSec: number;
  isPlaying: boolean;
  enginePhase?: PreviewEnginePhase;
  previewBufferedRanges?: PreviewBufferedRange[];
  bufferingRange?: PreviewBufferedRange | null;
  queueDepth?: number;
  queueMinTimeSec?: number | null;
  queueMaxTimeSec?: number | null;
  decodedFrames?: number;
  hasCurrentFrame?: boolean;
  metadata?: PreviewEngineMetadata;
  error?: string;
};

export type PreviewEngineFrameResult = {
  ok: boolean;
  width: number;
  height: number;
  timeSec: number;
  sequence?: number;
  isNew?: boolean;
  queueDepth?: number;
  rgba?: Uint8Array;
  error?: string;
};
