import { AV_NOPTS_VALUE } from "./nodeAvConstants";

export type FrameTimeStream = {
  startTime: bigint;
  timeBase: { num: number; den: number };
};

export type FrameTimeSource = {
  pts: bigint;
  pktDts: bigint;
  bestEffortTimestamp: bigint;
  timeBase: { num: number; den: number };
};

function rationalToSeconds(ticks: bigint, timeBase: { num: number; den: number }): number {
  if (timeBase.den === 0) {
    return 0;
  }
  return Number(ticks) * (timeBase.num / timeBase.den);
}

function streamStartPts(stream: FrameTimeStream): bigint {
  const start = stream.startTime;
  return start !== AV_NOPTS_VALUE ? start : 0n;
}

export function frameTimeSec(
  frame: FrameTimeSource,
  stream: FrameTimeStream,
  maxDurationSec = 0
): number | null {
  const timeBase = frame.timeBase.den > 0 ? frame.timeBase : stream.timeBase;

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

  const seconds = rationalToSeconds(pts - streamStartPts(stream), timeBase);
  if (!Number.isFinite(seconds) || seconds < -0.5) {
    return null;
  }
  if (maxDurationSec > 0 && seconds > maxDurationSec + 1) {
    return null;
  }
  return seconds;
}
