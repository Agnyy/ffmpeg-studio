import type { PreviewEngineFrameResult } from "./ipcTypes";
import type { QueuedVideoFrame } from "./types";

export function toIpcFrame(
  frame: QueuedVideoFrame,
  options: { queueDepth: number; isNew?: boolean }
): PreviewEngineFrameResult {
  return {
    ok: true,
    width: frame.width,
    height: frame.height,
    timeSec: frame.timeSec,
    sequence: frame.sequence,
    isNew: options.isNew ?? true,
    queueDepth: options.queueDepth,
    rgba: frame.rgba,
  };
}
