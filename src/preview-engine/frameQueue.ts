import type { QueuedVideoFrame } from "./types";

export class FrameQueue {
  private frames: QueuedVideoFrame[] = [];
  private readonly maxSize: number;
  private _depthSum = 0;
  private _depthSamples = 0;
  private _depthMax = 0;

  constructor(maxSize = 4) {
    this.maxSize = maxSize;
  }

  get length(): number {
    return this.frames.length;
  }

  get avgDepth(): number {
    return this._depthSamples > 0 ? this._depthSum / this._depthSamples : 0;
  }

  get maxDepth(): number {
    return this._depthMax;
  }

  get depthSum(): number {
    return this._depthSum;
  }

  get depthSamples(): number {
    return this._depthSamples;
  }

  private recordDepth(): void {
    const depth = this.frames.length;
    this._depthSum += depth;
    this._depthSamples += 1;
    if (depth > this._depthMax) {
      this._depthMax = depth;
    }
  }

  push(frame: QueuedVideoFrame): number {
    let overflowDrops = 0;
    while (this.frames.length >= this.maxSize) {
      this.frames.shift();
      overflowDrops += 1;
    }
    this.frames.push(frame);
    this.recordDepth();
    return overflowDrops;
  }

  popForTime(timeSec: number): QueuedVideoFrame | null {
    const epsilon = 0.05;
    while (this.frames.length > 1 && this.frames[0]!.timeSec + epsilon < timeSec) {
      this.frames.shift();
    }
    if (this.frames.length === 0) {
      return null;
    }
    const head = this.frames[0]!;
    if (head.timeSec <= timeSec + epsilon) {
      return this.frames.shift() ?? null;
    }
    return null;
  }

  /** Best frame at or after target; used when paused after seek. */
  popClosestAtOrAfter(timeSec: number, epsilon = 0.05): QueuedVideoFrame | null {
    while (this.frames.length > 0 && this.frames[0]!.timeSec + epsilon < timeSec) {
      this.frames.shift();
    }
    return this.frames.shift() ?? null;
  }

  shift(): QueuedVideoFrame | null {
    const frame = this.frames.shift() ?? null;
    if (frame) {
      this.recordDepth();
    }
    return frame;
  }

  flush(): number {
    const dropped = this.frames.length;
    this.frames = [];
    return dropped;
  }

  hasFrameAtOrAfter(timeSec: number, epsilon = 0.05): boolean {
    return this.frames.some((frame) => frame.timeSec + epsilon >= timeSec);
  }

  latestTimeSec(): number | null {
    if (this.frames.length === 0) {
      return null;
    }
    return this.frames[this.frames.length - 1]!.timeSec;
  }

  earliestTimeSec(): number | null {
    if (this.frames.length === 0) {
      return null;
    }
    return this.frames[0]!.timeSec;
  }

  timeRange(): { min: number | null; max: number | null } {
    return {
      min: this.earliestTimeSec(),
      max: this.latestTimeSec(),
    };
  }

  /** Drop frames strictly older than minTimeSec. */
  dropOlderThan(minTimeSec: number): number {
    let dropped = 0;
    while (this.frames.length > 0 && this.frames[0]!.timeSec < minTimeSec) {
      this.frames.shift();
      dropped += 1;
    }
    if (dropped > 0) {
      this.recordDepth();
    }
    return dropped;
  }

  /**
   * Playback display: drop frames far behind playhead, return newest decoded frame at or before target.
   */
  takeForPlayback(
    targetSec: number,
    staleBehindSec = 0.5
  ): { frame: QueuedVideoFrame | null; staleDropped: number } {
    const staleDropped = this.dropOlderThan(targetSec - staleBehindSec);

    if (this.frames.length === 0) {
      return { frame: null, staleDropped };
    }

    const epsilon = 0.05;
    let pickIdx = -1;
    for (let i = 0; i < this.frames.length; i += 1) {
      if (this.frames[i]!.timeSec <= targetSec + epsilon) {
        pickIdx = i;
      }
    }

    if (pickIdx >= 0) {
      const frame = this.frames[pickIdx]!;
      this.frames.splice(0, pickIdx + 1);
      this.recordDepth();
      return { frame, staleDropped };
    }

    const head = this.frames[0]!;
    if (head.timeSec <= targetSec + 0.75) {
      this.frames.shift();
      this.recordDepth();
      return { frame: head, staleDropped };
    }

    return { frame: null, staleDropped };
  }
}
