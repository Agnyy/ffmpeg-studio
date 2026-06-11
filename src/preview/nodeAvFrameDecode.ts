import { AV_NOPTS_VALUE } from "./nodeAvConstants";
import type {
  NodeAvDecoder,
  NodeAvDemuxer,
  NodeAvFrame,
  NodeAvStream,
} from "./nodeAvTypes";

const MAX_PACKETS = 300;
const MAX_FRAMES = 120;
const START_READ_THRESHOLD_SEC = 0.05;
const GLOBAL_SEEK_STREAM_INDEX = -1;

export type NodeAvDecodedFrame = {
  frame: NodeAvFrame;
  actualTimeSec: number | null;
};

export type NodeAvDecodeOutcome = {
  decoded: NodeAvDecodedFrame | null;
  requestedTimeSec: number;
  usedFallback: boolean;
  warning?: string;
};

function rationalToSeconds(ticks: bigint, timeBase: { num: number; den: number }): number {
  if (timeBase.den === 0) {
    return 0;
  }
  return Number(ticks) * (timeBase.num / timeBase.den);
}

function streamStartPts(stream: NodeAvStream): bigint {
  const start = stream.startTime;
  return start !== AV_NOPTS_VALUE ? start : 0n;
}

/** PTS in stream time_base units for a wall-clock position. */
export function secondsToStreamPts(seconds: number, stream: NodeAvStream): bigint {
  const timeBase = stream.timeBase;
  const ticks = Math.round(seconds * (timeBase.den / timeBase.num));
  return streamStartPts(stream) + BigInt(ticks);
}

export function frameTimeSec(
  frame: NodeAvFrame,
  stream: NodeAvStream,
  maxDurationSec = 0
): number | null {
  const timeBase =
    frame.timeBase.den > 0 ? frame.timeBase : stream.timeBase;

  let pts = frame.bestEffortTimestamp;
  if (pts === AV_NOPTS_VALUE) {
    pts = frame.pts;
  }
  if (pts === AV_NOPTS_VALUE) {
    pts = frame.pktDts;
  }
  if (pts === AV_NOPTS_VALUE) {
    return null;
  }

  const startPts = streamStartPts(stream);
  const seconds = rationalToSeconds(pts - startPts, timeBase);
  if (!Number.isFinite(seconds) || seconds < -0.5) {
    return null;
  }
  if (maxDurationSec > 0 && seconds > maxDurationSec + 1) {
    return null;
  }
  return seconds;
}

export function streamDurationSec(stream: NodeAvStream, formatDurationSec: number): number {
  if (formatDurationSec > 0) {
    return formatDurationSec;
  }
  const durationTicks = stream.duration;
  if (durationTicks > 0n && durationTicks !== AV_NOPTS_VALUE) {
    return rationalToSeconds(durationTicks, stream.timeBase);
  }
  return 0;
}

function pickBestCandidate(
  candidates: NodeAvDecodedFrame[],
  requestedTimeSec: number,
  acceptFirstDecoded: boolean
): NodeAvDecodedFrame | null {
  if (candidates.length === 0) {
    return null;
  }

  if (acceptFirstDecoded) {
    return (
      candidates.find((entry) => entry.actualTimeSec !== null) ?? candidates[0] ?? null
    );
  }

  const epsilon = 0.001;
  const atOrAfter = candidates.find(
    (entry) => entry.actualTimeSec !== null && entry.actualTimeSec + epsilon >= requestedTimeSec
  );
  if (atOrAfter) {
    return atOrAfter;
  }

  let best: NodeAvDecodedFrame | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const entry of candidates) {
    if (entry.actualTimeSec === null) {
      if (!best) {
        best = entry;
      }
      continue;
    }
    const distance = Math.abs(entry.actualTimeSec - requestedTimeSec);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }

  return best ?? candidates[0] ?? null;
}

async function collectDecodedFrames(
  demuxer: NodeAvDemuxer,
  decoder: NodeAvDecoder,
  videoStreamIndex: number,
  stream: NodeAvStream,
  requestedTimeSec: number,
  stopAfterFirstFrame: boolean,
  maxDurationSec: number
): Promise<NodeAvDecodedFrame[]> {
  const candidates: NodeAvDecodedFrame[] = [];
  let packetCount = 0;
  let frameCount = 0;
  const epsilon = 0.001;
  const packetIterator = demuxer.packets(videoStreamIndex)[Symbol.asyncIterator]();

  try {
    while (packetCount < MAX_PACKETS && frameCount < MAX_FRAMES) {
      const step = await packetIterator.next();
      if (step.done) {
        break;
      }

      const packet = step.value;
      if (!packet) {
        break;
      }
      packetCount += 1;

      try {
        const frames = await decoder.decodeAll(packet);
        for (const frame of frames) {
          if (!frame) {
            continue;
          }
          frameCount += 1;
          const candidate: NodeAvDecodedFrame = {
            frame,
            actualTimeSec: frameTimeSec(frame, stream, maxDurationSec),
          };
          candidates.push(candidate);

          if (stopAfterFirstFrame) {
            return candidates;
          }

          if (
            candidate.actualTimeSec !== null &&
            candidate.actualTimeSec + epsilon >= requestedTimeSec
          ) {
            return candidates;
          }

          if (frameCount >= MAX_FRAMES) {
            return candidates;
          }
        }
      } finally {
        packet.free();
      }
    }
  } finally {
    if (typeof packetIterator.return === "function") {
      await packetIterator.return();
    }
  }

  return candidates;
}

async function decodeAfterSeek(
  getDemuxer: () => NodeAvDemuxer,
  decoder: NodeAvDecoder,
  videoStreamIndex: number,
  stream: NodeAvStream,
  requestedTimeSec: number,
  seekFlags: number,
  skipSeek: boolean,
  stopAfterFirstFrame: boolean,
  getDecoder: () => NodeAvDecoder,
  resetDecoder: () => Promise<void>,
  maxDurationSec: number,
  reopenDemuxer?: () => Promise<boolean>
): Promise<{ decoded: NodeAvDecodedFrame | null }> {
  let activeDecoder = decoder;

  if (!skipSeek) {
    if (reopenDemuxer) {
      const reopened = await reopenDemuxer();
      if (!reopened) {
        return { decoded: null };
      }
      activeDecoder = getDecoder();
    }

    const seekTarget =
      requestedTimeSec <= START_READ_THRESHOLD_SEC ? 0 : requestedTimeSec;
    const demuxer = getDemuxer();
    const ret = await demuxer.seek(seekTarget, GLOBAL_SEEK_STREAM_INDEX, seekFlags);
    if (ret < 0) {
      return {
        decoded: null,
      };
    }
    await resetDecoder();
    activeDecoder = getDecoder();
  }

  const candidates = await collectDecodedFrames(
    getDemuxer(),
    activeDecoder,
    videoStreamIndex,
    stream,
    requestedTimeSec,
    stopAfterFirstFrame,
    maxDurationSec
  );

  return {
    decoded: pickBestCandidate(
      candidates,
      requestedTimeSec,
      stopAfterFirstFrame
    ),
  };
}

export async function decodeNodeAvFrameAt(
  videoStreamIndex: number,
  stream: NodeAvStream,
  requestedTimeSec: number,
  options: {
    seekFlags: number;
    formatDurationSec: number;
    readFromStart: boolean;
    getDemuxer: () => NodeAvDemuxer;
    getDecoder: () => NodeAvDecoder;
    resetDecoder: () => Promise<void>;
    reopenDemuxer?: () => Promise<boolean>;
    log?: (message: string) => void;
  }
): Promise<NodeAvDecodeOutcome> {
  const durationSec = streamDurationSec(stream, options.formatDurationSec);
  const clampedRequest =
    durationSec > 0
      ? Math.max(0, Math.min(durationSec, requestedTimeSec))
      : Math.max(0, requestedTimeSec);

  const skipSeekOnFirstRead =
    options.readFromStart && clampedRequest <= START_READ_THRESHOLD_SEC;
  const durationLimit = durationSec;

  const firstPass = await decodeAfterSeek(
    options.getDemuxer,
    options.getDecoder(),
    videoStreamIndex,
    stream,
    clampedRequest,
    options.seekFlags,
    skipSeekOnFirstRead,
    skipSeekOnFirstRead,
    options.getDecoder,
    options.resetDecoder,
    durationLimit,
    options.reopenDemuxer
  );

  if (firstPass.decoded) {
    return {
      decoded: firstPass.decoded,
      requestedTimeSec: clampedRequest,
      usedFallback: false,
    };
  }

  const warning =
    "node-av decode: seek produced no frame; falling back to first frame from start";
  options.log?.(warning);

  const fallbackPass = await decodeAfterSeek(
    options.getDemuxer,
    options.getDecoder(),
    videoStreamIndex,
    stream,
    0,
    options.seekFlags,
    false,
    true,
    options.getDecoder,
    options.resetDecoder,
    durationLimit,
    options.reopenDemuxer
  );
  return {
    decoded: fallbackPass.decoded,
    requestedTimeSec: clampedRequest,
    usedFallback: Boolean(fallbackPass.decoded),
    warning: fallbackPass.decoded ? warning : undefined,
  };
}
