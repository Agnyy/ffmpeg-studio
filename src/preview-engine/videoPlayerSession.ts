import { cpus } from "node:os";
import { MasterClock } from "./clock";
import { frameTimeSec } from "./frameTime";
import { FrameQueue } from "./frameQueue";
import { loadNodeAvApi } from "./nodeAvLoader";
import { previewDecodeMutex } from "./previewDecodeMutex";
import { getPreviewDecoderCreateOptions } from "./previewDecoderConfig";
import {
  decodeFrameAtRandomAccessLocked,
  type RandomAccessDecodeResult,
} from "./randomAccessDecoder";
import {
  AVSEEK_FLAG_BACKWARD,
  GLOBAL_SEEK_STREAM_INDEX,
} from "./nodeAvConstants";
import type { PreviewBufferedRange } from "../shared/previewBufferedRanges";
import type {
  PlayerRunMetrics,
  PlayerTestReport,
  PreviewEngineMetadata,
  PreviewEnginePhase,
  QueuedVideoFrame,
} from "./types";

const MAX_QUEUE_SIZE = 4;
const MAX_PREVIEW_WIDTH = 1280;
const DISPLAY_TICK_MS = 1000 / 30;
const DECODE_IDLE_MS = 2;
const PREVIEW_RANGE_MERGE_GAP_SEC = 1.0;
const RANDOM_ACCESS_TOLERANCE_SEC = 1.5;
const PLAYBACK_QUEUE_TOLERANCE_SEC = 0.75;
const PLAYBACK_PREFILL_NEAR_SEC = 0.15;
const PLAYBACK_STALE_QUEUE_SEC = 0.5;

type PacketIterator = AsyncIterator<unknown> & {
  return?: () => Promise<{ done: boolean; value?: unknown }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function emptyMetrics(file: string): PlayerRunMetrics {
  return {
    file,
    metadata: null,
    decodedFrames: 0,
    displayedFrames: 0,
    droppedFrames: 0,
    queueOverflowDrops: 0,
    displayUnderruns: 0,
    decodeMsTotal: 0,
    decodeMsMax: 0,
    queueDepthSum: 0,
    queueDepthSamples: 0,
    queueDepthMax: 0,
    seekCount: 0,
    demuxerReopenCount: 0,
    playbackWallSec: 0,
    sequentialDecodeOk: true,
    errors: [],
  };
}

export class VideoPlayerSession {
  // Runtime node-av instances — typed loosely to avoid static node-av imports.
  private demuxer: any = null;
  private decoder: any = null;
  private scaler: any = null;
  private videoStream: any = null;
  private videoStreamIndex = -1;
  private metadata: PreviewEngineMetadata | null = null;
  private packetIterator: PacketIterator | null = null;
  private eof = false;

  private readonly clock = new MasterClock();
  private readonly queue = new FrameQueue(MAX_QUEUE_SIZE);
  private readonly metrics: PlayerRunMetrics;

  private running = false;
  private decodeRunning = false;
  private displayRunning = false;
  private seekInFlight = false;
  private seekLockOwner = 0;
  private nativeDecodeSuspended = false;
  private pendingSeekSec: number | null = null;
  private cpuStart: NodeJS.CpuUsage | null = null;
  private currentFrame: QueuedVideoFrame | null = null;
  private pausedPollSequence: number | null = null;
  private frameSequence = 0;
  private seekGeneration = 0;
  private enginePhase: PreviewEnginePhase = "idle";
  private previewBufferedRanges: PreviewBufferedRange[] = [];
  private activeBufferingRange: PreviewBufferedRange | null = null;
  private catchUpDecodeScheduled = false;
  private lastCatchUpAtMs = 0;

  constructor(filePath: string) {
    this.metrics = emptyMetrics(filePath);
  }

  getMetadata(): PreviewEngineMetadata | null {
    return this.metadata;
  }

  getPlayhead(): number {
    return this.getPlaybackTargetSec();
  }

  /** Wall clock capped to decoded queue frontier so display/audio do not outrun decode. */
  private getPlaybackTargetSec(): number {
    if (!this.clock.isPlaying()) {
      return this.clock.now();
    }
    const wall = this.clock.now();
    const latest = this.queue.latestTimeSec();
    if (latest === null) {
      return this.currentFrame?.timeSec ?? wall;
    }
    return Math.min(wall, latest + PLAYBACK_STALE_QUEUE_SEC);
  }

  isPlaying(): boolean {
    return this.clock.isPlaying();
  }

  getQueueDepth(): number {
    return this.queue.length;
  }

  getQueueTimeRange(): { min: number | null; max: number | null } {
    return this.queue.timeRange();
  }

  hasCurrentFrame(): boolean {
    return this.currentFrame !== null;
  }

  getEnginePhase(): PreviewEnginePhase {
    return this.enginePhase;
  }

  getPreviewBufferedRanges(): PreviewBufferedRange[] {
    return this.previewBufferedRanges.map((range) => ({ ...range }));
  }

  getActiveBufferingRange(): PreviewBufferedRange | null {
    return this.activeBufferingRange ? { ...this.activeBufferingRange } : null;
  }

  getCurrentFrame(): QueuedVideoFrame | null {
    return this.currentFrame;
  }

  startUi(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    void this.decodeLoop();
  }

  play(): void {
    void this.playFrom(this.clock.now());
  }

  /**
   * Start playback from a source time, seeking/decoding first when the target is not buffered.
   */
  async playFrom(sourceTime: number): Promise<{
    ok: boolean;
    frame: QueuedVideoFrame | null;
    playheadSec: number;
    warning?: string;
    cancelled?: boolean;
  }> {
    if (!this.running) {
      this.startUi();
    }

    const clamped = this.clampSourceTime(sourceTime);
    const needsPrepare = !this.hasDisplayFrameNear(clamped, RANDOM_ACCESS_TOLERANCE_SEC);

    if (needsPrepare) {
      const myGeneration = ++this.seekGeneration;
      const hold = await this.executeSeekHold(clamped, {
        generation: myGeneration,
        resumeIfWasPlaying: false,
      });
      if (hold.cancelled) {
        return {
          ok: false,
          frame: this.currentFrame,
          playheadSec: this.clock.now(),
          cancelled: true,
        };
      }
      if (!hold.frame) {
        return {
          ok: false,
          frame: this.currentFrame,
          playheadSec: this.clock.now(),
          warning: hold.warning ?? `No frame available to play from ${clamped.toFixed(3)}s`,
        };
      }
    } else {
      await previewDecodeMutex.runExclusive(async () => {
        const latest = this.queue.latestTimeSec();
        if (latest === null || latest < clamped - 0.25) {
          await this.resetPlaybackContextAtLocked(clamped);
        }
        await this.decodeForwardUntilLocked(clamped + 0.35, 48);
      });
      this.clock.pause();
      this.clock.seek(clamped);
    }

    this.beginPreviewBufferingAt(clamped);

    const queueReady = await this.waitForPlaybackQueue(1, 3_000, clamped - 0.25);
    if (!queueReady && !this.eof) {
      if (this.enginePhase !== "error") {
        this.enginePhase = "paused";
      }
      return {
        ok: false,
        frame: this.currentFrame,
        playheadSec: this.clock.now(),
        warning: `Playback queue not ready near ${clamped.toFixed(3)}s (queue=${this.queue.length}, latest=${this.queue.latestTimeSec()?.toFixed(3) ?? "null"}, decoded=${this.metrics.decodedFrames})`,
      };
    }

    this.clock.start(clamped);
    if (this.enginePhase !== "seeking" && this.enginePhase !== "error") {
      this.enginePhase = "playing";
    }

    const initialPull = this.pullDisplayFrame();

    return {
      ok: true,
      frame: initialPull?.frame ?? this.currentFrame,
      playheadSec: this.clock.now(),
    };
  }

  async waitForPlaybackQueue(
    minDepth = 1,
    timeoutMs = 750,
    minLatestTimeSec?: number
  ): Promise<boolean> {
    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      const depthOk = this.queue.length >= minDepth;
      const latest = this.queue.latestTimeSec();
      const timeOk =
        minLatestTimeSec === undefined ||
        (latest !== null && latest >= minLatestTimeSec);
      if (depthOk && timeOk) {
        return true;
      }
      if (!this.clock.isPlaying() && minLatestTimeSec === undefined) {
        return false;
      }
      if (this.eof && this.queue.length === 0) {
        return false;
      }
      await sleep(10);
    }
    const latest = this.queue.latestTimeSec();
    return (
      this.queue.length >= minDepth &&
      (minLatestTimeSec === undefined ||
        (latest !== null && latest >= minLatestTimeSec))
    );
  }

  pause(): void {
    this.clock.pause();
    if (this.activeBufferingRange) {
      this.finalizePreviewBuffering();
    }
    if (this.enginePhase !== "seeking" && this.enginePhase !== "buffering" && this.enginePhase !== "error") {
      this.enginePhase = "paused";
    }
  }

  /**
   * Atomic seek safe during playback: pause clock/decode, flush queue, seek, draw hold,
   * resume play when the session was playing before the seek.
   */
  async requestSeekDuringPlayback(
    timeSec: number
  ): Promise<{
    frame: QueuedVideoFrame | null;
    warning?: string;
    cancelled?: boolean;
  }> {
    const myGeneration = ++this.seekGeneration;
    return this.executeSeekHold(timeSec, {
      generation: myGeneration,
      resumeIfWasPlaying: true,
    });
  }

  async seekAndHold(
    timeSec: number
  ): Promise<{
    frame: QueuedVideoFrame | null;
    warning?: string;
    cancelled?: boolean;
  }> {
    const myGeneration = ++this.seekGeneration;
    const result = await this.executeSeekHold(timeSec, {
      generation: myGeneration,
      resumeIfWasPlaying: false,
    });
    if (result.cancelled) {
      return {
        frame: this.currentFrame,
        warning: "Seek superseded by a newer request",
        cancelled: true,
      };
    }
    if (result.frame) {
      return { frame: result.frame };
    }
    return {
      frame: null,
      warning: result.warning ?? `No frame decoded for seek at ${timeSec.toFixed(3)}s`,
    };
  }

  private async executeSeekHold(
    timeSec: number,
    options: { generation: number; resumeIfWasPlaying: boolean }
  ): Promise<{
    frame: QueuedVideoFrame | null;
    warning?: string;
    cancelled?: boolean;
  }> {
    const { generation: myGeneration, resumeIfWasPlaying } = options;
    const wasPlaying = resumeIfWasPlaying && this.clock.isPlaying();
    const previousFrame = this.currentFrame;
    const clamped = this.clampSourceTime(timeSec);

    this.enginePhase = "seeking";
    this.clock.pause();
    this.pendingSeekSec = null;

    while (this.seekInFlight) {
      await sleep(5);
      if (myGeneration !== this.seekGeneration) {
        return { frame: this.currentFrame, cancelled: true };
      }
    }

    this.seekInFlight = true;
    this.seekLockOwner = myGeneration;
    this.metrics.seekCount += 1;
    this.nativeDecodeSuspended = true;

    try {
      this.beginPreviewBufferingAt(clamped);
      let seekOk = false;
      await previewDecodeMutex.runExclusive(async () => {
        if (myGeneration !== this.seekGeneration) {
          return;
        }
        seekOk = await this.performPausedSeekLocked(clamped);
      });

      if (myGeneration !== this.seekGeneration) {
        return { frame: this.currentFrame, cancelled: true };
      }

      this.finalizePreviewBuffering();

      const frameAtTarget =
        seekOk &&
        this.currentFrame !== null &&
        this.hasDisplayFrameNear(clamped, RANDOM_ACCESS_TOLERANCE_SEC);

      if (!frameAtTarget) {
        const revertTime = previousFrame?.timeSec ?? this.clock.now();
        if (previousFrame) {
          this.currentFrame = previousFrame;
          this.pausedPollSequence = null;
        } else {
          this.currentFrame = null;
        }
        this.clock.seek(revertTime);
        const actual = this.currentFrame?.timeSec;
        const warning =
          actual !== undefined
            ? `Seek to ${clamped.toFixed(3)}s failed (nearest decoded ${actual.toFixed(3)}s)`
            : `No frame decoded for seek at ${clamped.toFixed(3)}s`;
        if (wasPlaying && myGeneration === this.seekGeneration) {
          this.resumePlaybackAt(revertTime);
        } else if (myGeneration === this.seekGeneration) {
          this.enginePhase = "paused";
        }
        return { frame: null, warning };
      }

      if (wasPlaying && myGeneration === this.seekGeneration) {
        this.resumePlaybackAt(this.currentFrame!.timeSec);
      } else if (myGeneration === this.seekGeneration) {
        this.enginePhase = "paused";
      }

      return { frame: this.currentFrame };
    } catch (error) {
      if (myGeneration === this.seekGeneration) {
        this.enginePhase = "error";
        this.metrics.errors.push(error instanceof Error ? error.message : String(error));
      }
      if (previousFrame && !this.currentFrame) {
        this.currentFrame = previousFrame;
        this.pausedPollSequence = null;
        this.clock.seek(previousFrame.timeSec);
      }
      if (wasPlaying && myGeneration === this.seekGeneration) {
        this.resumePlaybackAt(clamped);
      }
      throw error;
    } finally {
      this.nativeDecodeSuspended = false;
      if (this.seekLockOwner === myGeneration) {
        this.seekInFlight = false;
        this.seekLockOwner = 0;
      }
    }
  }

  private scheduleCatchUpDecodeIfNeeded(): void {
    if (!this.clock.isPlaying() || this.seekInFlight || this.catchUpDecodeScheduled) {
      return;
    }
    const targetSec = this.clock.now();
    const latestSec = this.queue.latestTimeSec();
    if (latestSec !== null && targetSec - latestSec <= PLAYBACK_QUEUE_TOLERANCE_SEC) {
      return;
    }

    const now = performance.now();
    if (now - this.lastCatchUpAtMs < 1000) {
      return;
    }

    this.catchUpDecodeScheduled = true;
    this.lastCatchUpAtMs = now;
    void previewDecodeMutex.runExclusive(async () => {
      try {
        if (!this.clock.isPlaying() || this.seekInFlight) {
          return;
        }
        const playhead = this.clock.now();
        const latest = this.queue.latestTimeSec();
        if (latest !== null && playhead - latest <= PLAYBACK_QUEUE_TOLERANCE_SEC) {
          return;
        }
        await this.catchUpPlaybackAtLocked(playhead);
      } finally {
        this.catchUpDecodeScheduled = false;
      }
    });
  }

  /** Random-access snap + sequential refill when playback decode falls behind the wall clock. */
  private async catchUpPlaybackAtLocked(playheadSec: number): Promise<void> {
    const clamped = this.clampSourceTime(playheadSec);
    const decoded = await decodeFrameAtRandomAccessLocked(
      this.metrics.file,
      clamped,
      PLAYBACK_QUEUE_TOLERANCE_SEC,
      this.metadata?.durationSec ?? 0
    );

    if (!decoded.ok || !decoded.frame) {
      await this.seekPlaybackDecodeLocked(clamped);
      return;
    }

    const actualTime = decoded.actualTimeSec ?? decoded.frame.timeSec;
    await this.resetPlaybackContextAtLocked(actualTime);

    this.frameSequence += 1;
    const snapshot = { ...decoded.frame, sequence: this.frameSequence };
    this.currentFrame = snapshot;
    this.pushDecodedFrame(snapshot);
    this.noteDecodedSourceTime(actualTime);

    await this.decodeForwardUntilLocked(clamped - PLAYBACK_PREFILL_NEAR_SEC, 64);
  }

  pullDisplayFrame(): { frame: QueuedVideoFrame; isNew: boolean } | null {
    if (this.clock.isPlaying()) {
      const targetSec = this.getPlaybackTargetSec();
      const { frame, staleDropped } = this.queue.takeForPlayback(
        targetSec,
        PLAYBACK_STALE_QUEUE_SEC
      );
      if (staleDropped > 0) {
        this.metrics.droppedFrames += staleDropped;
      }
      if (frame) {
        const isNew =
          !this.currentFrame || this.currentFrame.sequence !== frame.sequence;
        this.currentFrame = frame;
        if (isNew) {
          this.metrics.displayedFrames += 1;
        }
        return { frame, isNew };
      }

      if (!this.eof || this.queue.length > 0) {
        this.metrics.displayUnderruns += 1;
      }

      if (
        this.currentFrame &&
        targetSec - this.currentFrame.timeSec <= PLAYBACK_QUEUE_TOLERANCE_SEC
      ) {
        return { frame: this.currentFrame, isNew: false };
      }

      this.scheduleCatchUpDecodeIfNeeded();
      return null;
    }

    if (!this.currentFrame) {
      return null;
    }

    const isNew = this.pausedPollSequence !== this.currentFrame.sequence;
    if (isNew) {
      this.pausedPollSequence = this.currentFrame.sequence;
      this.metrics.displayedFrames += 1;
    }
    return { frame: this.currentFrame, isNew };
  }

  /** Open must leave currentFrame ready via random-access decode at 0s. */
  async primeInitialFrame(): Promise<boolean> {
    this.clock.pause();
    this.clock.seek(0);

    const dropped = this.queue.flush();
    this.metrics.droppedFrames += dropped;
    this.currentFrame = null;
    this.pausedPollSequence = null;

    const primeOutcome: {
      decoded: RandomAccessDecodeResult | null;
      playbackReady: boolean;
    } = { decoded: null, playbackReady: false };

    await previewDecodeMutex.runExclusive(async () => {
      primeOutcome.decoded = await decodeFrameAtRandomAccessLocked(
        this.metrics.file,
        0,
        RANDOM_ACCESS_TOLERANCE_SEC,
        this.metadata?.durationSec ?? 0
      );
      if (!primeOutcome.decoded.ok || !primeOutcome.decoded.frame) {
        return;
      }
      const actualTime =
        primeOutcome.decoded.actualTimeSec ?? primeOutcome.decoded.frame.timeSec;
      this.frameSequence += 1;
      this.currentFrame = { ...primeOutcome.decoded.frame, sequence: this.frameSequence };
      this.clock.seek(actualTime);
      this.beginPreviewBufferingAt(actualTime);
      primeOutcome.playbackReady = await this.resetPlaybackContextAtLocked(actualTime);
    });

    if (!primeOutcome.decoded?.ok || !primeOutcome.decoded.frame) {
      this.metrics.errors.push(
        primeOutcome.decoded?.error ?? "Engine opened file but failed to decode initial frame"
      );
      return false;
    }

    if (!primeOutcome.playbackReady) {
      this.metrics.errors.push("Engine failed to prepare playback context at 0s");
      return false;
    }
    return true;
  }

  private async safeClosePlaybackContextLocked(): Promise<void> {
    await previewDecodeMutex.withClosingContext(async () => {
      await this.stopPacketIteratorLocked();
      if (this.decoder) {
        try {
          await this.decoder.flush?.();
        } catch {
          // ignore flush errors during teardown
        }
        this.decoder[Symbol.dispose]?.();
        this.decoder = null;
      }
      if (this.demuxer) {
        await this.demuxer.close();
        this.demuxer = null;
      }
      this.packetIterator = null;
      this.videoStream = null;
      this.videoStreamIndex = -1;
    });
  }

  private async reopenMainPlaybackAtLocked(targetSec: number): Promise<boolean> {
    const clamped = this.clampSourceTime(targetSec);
    try {
      await this.safeClosePlaybackContextLocked();

      const { Demuxer, Decoder, Scaler } = await loadNodeAvApi();
      const decoderOptions = await getPreviewDecoderCreateOptions();
      this.demuxer = await Demuxer.open(this.metrics.file);
      this.metrics.demuxerReopenCount += 1;
      const videoStream = this.demuxer.video();
      if (!videoStream) {
        return false;
      }

      this.videoStream = videoStream;
      this.videoStreamIndex = videoStream.index;
      if (!this.scaler) {
        this.scaler = new Scaler();
      }
      this.decoder = await Decoder.create(videoStream, decoderOptions as never);
      this.eof = false;

      let seekResult = await this.demuxer.seek(
        clamped,
        GLOBAL_SEEK_STREAM_INDEX,
        AVSEEK_FLAG_BACKWARD
      );
      if (seekResult < 0 && clamped > 0.05) {
        seekResult = await this.demuxer.seek(0, GLOBAL_SEEK_STREAM_INDEX, AVSEEK_FLAG_BACKWARD);
      }
      if (seekResult < 0) {
        this.metrics.errors.push(
          `Main demuxer reopen seek failed (${seekResult}) at ${clamped.toFixed(3)}s`
        );
        return false;
      }

      this.packetIterator = this.demuxer
        .packets(this.videoStreamIndex)
        [Symbol.asyncIterator]() as PacketIterator;
      return true;
    } catch (error) {
      this.metrics.errors.push(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private async resetPlaybackContextAtLocked(sourceTime: number): Promise<boolean> {
    const clamped = this.clampSourceTime(sourceTime);
    const dropped = this.queue.flush();
    this.metrics.droppedFrames += dropped;
    this.eof = false;

    const reopened = await this.reopenMainPlaybackAtLocked(clamped);
    if (!reopened) {
      return false;
    }

    await this.decodeForwardUntilLocked(clamped - PLAYBACK_PREFILL_NEAR_SEC, 200);
    this.queue.dropOlderThan(clamped - PLAYBACK_STALE_QUEUE_SEC);

    if (process.env.PREVIEW_ENGINE_QUEUE_ASSERT === "1") {
      const range = this.queue.timeRange();
      if (range.min !== null && range.min < clamped - PLAYBACK_STALE_QUEUE_SEC) {
        this.metrics.errors.push(
          `Queue min ${range.min.toFixed(3)}s stale after reset at ${clamped.toFixed(3)}s`
        );
      }
    }

    return true;
  }

  /** Reposition sequential decode near playhead without tearing down demuxer/decoder. */
  private async seekPlaybackDecodeLocked(targetSec: number): Promise<boolean> {
    if (!this.demuxer || !this.decoder || !this.videoStream) {
      return this.resetPlaybackContextAtLocked(targetSec);
    }

    const clamped = this.clampSourceTime(targetSec);
    this.queue.dropOlderThan(clamped - PLAYBACK_STALE_QUEUE_SEC);
    this.eof = false;

    await this.stopPacketIteratorLocked();

    let seekResult = await this.demuxer.seek(
      clamped,
      GLOBAL_SEEK_STREAM_INDEX,
      AVSEEK_FLAG_BACKWARD
    );
    if (seekResult < 0 && clamped > 0.05) {
      seekResult = await this.demuxer.seek(0, GLOBAL_SEEK_STREAM_INDEX, AVSEEK_FLAG_BACKWARD);
    }
    if (seekResult < 0) {
      return this.resetPlaybackContextAtLocked(clamped);
    }

    try {
      await this.decoder.flush?.();
    } catch {
      // ignore flush errors during reposition
    }

    this.packetIterator = this.demuxer
      .packets(this.videoStreamIndex)
      [Symbol.asyncIterator]() as PacketIterator;

    const minLatest = clamped - PLAYBACK_PREFILL_NEAR_SEC;
    await this.decodeForwardUntilLocked(minLatest, 200, clamped - 0.75);
    this.queue.dropOlderThan(clamped - PLAYBACK_STALE_QUEUE_SEC);
    return true;
  }

  private async decodeForwardUntilLocked(
    minLatestSec: number,
    maxAttempts: number,
    minEnqueueTimeSec?: number
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts && !this.eof; attempt += 1) {
      const latest = this.queue.latestTimeSec();
      if (latest !== null && latest >= minLatestSec) {
        break;
      }

      if (this.queue.length >= MAX_QUEUE_SIZE) {
        const droppedFrame = this.queue.shift();
        if (droppedFrame) {
          this.metrics.droppedFrames += 1;
        }
      }

      await this.decodeAtLeastOneFrameLocked({ minEnqueueTimeSec });
    }
  }

  getMetrics(): PlayerRunMetrics {
    return {
      ...this.metrics,
      metadata: this.metadata,
      queueDepthSum: this.queue.depthSum,
      queueDepthSamples: this.queue.depthSamples,
      queueDepthMax: this.queue.maxDepth,
    };
  }

  async open(): Promise<boolean> {
    this.enginePhase = "opening";
    try {
      const { probe } = await loadNodeAvApi();
      const probeInfo = await probe(this.metrics.file);
      const video = probeInfo.video;

      const durationSec = probeInfo.duration > 0 ? probeInfo.duration : 0;

      this.metadata = {
        durationSec,
        width: video?.width ?? 0,
        height: video?.height ?? 0,
        fps: video?.frameRate ?? 30,
        pixelFormat: video?.pixelFormat ?? "unknown",
        codec: video?.codec ?? "unknown",
      };
      this.metrics.metadata = this.metadata;
      this.clock.pause();
      const primed = await this.primeInitialFrame();
      if (!primed) {
        this.enginePhase = "error";
        return false;
      }
      this.enginePhase = "paused";
      this.finalizePreviewBuffering();
      return true;
    } catch (error) {
      this.enginePhase = "error";
      this.metrics.errors.push(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async close(): Promise<void> {
    this.running = false;
    this.nativeDecodeSuspended = true;
    this.currentFrame = null;
    this.pausedPollSequence = null;
    while (this.decodeRunning || this.displayRunning) {
      await sleep(5);
    }
    await previewDecodeMutex.runExclusive(async () => {
      await this.safeClosePlaybackContextLocked();
      if (this.scaler) {
        this.scaler[Symbol.dispose]?.();
        this.scaler = null;
      }
    });
    this.nativeDecodeSuspended = false;
  }

  private async stopPacketIteratorLocked(): Promise<void> {
    if (this.packetIterator?.return) {
      try {
        await previewDecodeMutex.withReadingPacket(async () => {
          await this.packetIterator!.return!();
        });
      } catch {
        // ignore iterator cleanup errors
      }
    }
    this.packetIterator = null;
  }

  private resizeForFrame(frame: { width: number; height: number }): {
    width: number;
    height: number;
  } | undefined {
    if (frame.width <= MAX_PREVIEW_WIDTH) {
      return undefined;
    }
    return {
      width: MAX_PREVIEW_WIDTH,
      height: Math.max(2, Math.round((MAX_PREVIEW_WIDTH / frame.width) * frame.height)),
    };
  }

  private recordDecodeMs(ms: number): void {
    this.metrics.decodeMsTotal += ms;
    if (ms > this.metrics.decodeMsMax) {
      this.metrics.decodeMsMax = ms;
    }
  }

  private async encodeFrameToQueued(
    frame: {
      width: number;
      height: number;
      pts: bigint;
      pktDts: bigint;
      bestEffortTimestamp: bigint;
      timeBase: { num: number; den: number };
    },
    timeSec: number,
    decodeMs: number
  ): Promise<Omit<QueuedVideoFrame, "sequence">> {
    const resize = this.resizeForFrame(frame);
    const rgbaBuffer = await previewDecodeMutex.withScalingFrame(() =>
      this.scaler!.toBuffer(frame as never, {
        format: "rgba",
        resize,
      })
    );
    const outWidth = resize?.width ?? frame.width;
    const outHeight = resize?.height ?? frame.height;
    return {
      timeSec,
      width: outWidth,
      height: outHeight,
      decodeMs,
      rgba: Uint8Array.from(rgbaBuffer as ArrayLike<number>),
    };
  }

  private pushDecodedFrame(frame: QueuedVideoFrame): number {
    const overflowDrops = this.queue.push(frame);
    this.metrics.queueOverflowDrops += overflowDrops;
    this.metrics.droppedFrames += overflowDrops;
    return overflowDrops;
  }

  private clampSourceTime(timeSec: number): number {
    if (this.metadata && this.metadata.durationSec > 0) {
      return Math.max(0, Math.min(this.metadata.durationSec, timeSec));
    }
    return Math.max(0, timeSec);
  }

  private resumePlaybackAt(timeSec: number): void {
    const clamped = this.clampSourceTime(timeSec);
    this.beginPreviewBufferingAt(clamped);
    if (!this.running) {
      this.startUi();
    }
    this.clock.start(clamped);
    if (this.enginePhase !== "seeking" && this.enginePhase !== "error") {
      this.enginePhase = "playing";
    }
  }

  private hasDisplayFrameNear(targetSec: number, toleranceSec = 0.75): boolean {
    return (
      this.currentFrame !== null &&
      Math.abs(this.currentFrame.timeSec - targetSec) <= toleranceSec
    );
  }

  private isSourceTimeBuffered(timeSec: number): boolean {
    const epsilon = 0.15;
    return this.previewBufferedRanges.some(
      (range) => timeSec >= range.start - epsilon && timeSec <= range.end + epsilon
    );
  }

  private beginPreviewBufferingAt(timeSec: number): void {
    const clamped = this.clampSourceTime(timeSec);
    this.activeBufferingRange = { start: clamped, end: clamped };
    this.enginePhase = "buffering";
  }

  private finalizePreviewBuffering(): void {
    if (!this.activeBufferingRange) {
      return;
    }
    this.mergePreviewBufferedRange(
      this.activeBufferingRange.start,
      this.activeBufferingRange.end
    );
    this.activeBufferingRange = null;
  }

  private noteDecodedSourceTime(timeSec: number): void {
    const clamped = this.clampSourceTime(timeSec);
    if (this.activeBufferingRange) {
      this.activeBufferingRange.end = Math.max(this.activeBufferingRange.end, clamped);
      this.activeBufferingRange.start = Math.min(this.activeBufferingRange.start, clamped);
    }
  }

  private mergePreviewBufferedRange(start: number, end: number): void {
    const epsilon = PREVIEW_RANGE_MERGE_GAP_SEC;
    let rangeStart = Math.min(start, end);
    let rangeEnd = Math.max(start, end);

    const merged: PreviewBufferedRange[] = [];
    for (const existing of this.previewBufferedRanges) {
      if (existing.end + epsilon < rangeStart || existing.start - epsilon > rangeEnd) {
        merged.push(existing);
        continue;
      }
      rangeStart = Math.min(rangeStart, existing.start);
      rangeEnd = Math.max(rangeEnd, existing.end);
    }
    merged.push({ start: rangeStart, end: rangeEnd });
    merged.sort((a, b) => a.start - b.start);

    const compact: PreviewBufferedRange[] = [];
    for (const range of merged) {
      const last = compact[compact.length - 1];
      if (!last || range.start > last.end + epsilon) {
        compact.push({ ...range });
      } else {
        last.end = Math.max(last.end, range.end);
      }
    }
    this.previewBufferedRanges = compact;
  }

  private async pushDecodedFromNodeFrame(
    decoded: {
      width: number;
      height: number;
      pts: bigint;
      pktDts: bigint;
      bestEffortTimestamp: bigint;
      timeBase: { num: number; den: number };
    },
    timeSec: number,
    decodeMs: number
  ): Promise<void> {
    const queued = await this.encodeFrameToQueued(decoded, timeSec, decodeMs);
    this.frameSequence += 1;
    this.pushDecodedFrame({ ...queued, sequence: this.frameSequence });
    this.noteDecodedSourceTime(timeSec);
  }

  private async decodeAtLeastOneFrameLocked(options?: {
    minEnqueueTimeSec?: number;
  }): Promise<void> {
    if (!this.packetIterator || !this.decoder || !this.videoStream || this.eof) {
      return;
    }

    const step = await previewDecodeMutex.withReadingPacket(() => this.packetIterator!.next());
    if (step.done) {
      this.eof = true;
      return;
    }

    const packet = step.value as { free(): void } | null;
    if (!packet) {
      return;
    }

    const decodeStart = performance.now();
    try {
      const frames = (await previewDecodeMutex.withDecodingPacket(() =>
        this.decoder.decodeAll(packet)
      )) as Array<{
        width: number;
        height: number;
        pts: bigint;
        pktDts: bigint;
        bestEffortTimestamp: bigint;
        timeBase: { num: number; den: number };
      }>;
      const decodeMs = performance.now() - decodeStart;

      for (const frame of frames) {
        if (!frame) {
          continue;
        }
        const timeSec =
          frameTimeSec(frame, this.videoStream, this.metadata?.durationSec ?? 0) ??
          this.clock.now();
        const perFrameMs = frames.length > 0 ? decodeMs / frames.length : decodeMs;
        this.recordDecodeMs(perFrameMs);
        this.metrics.decodedFrames += 1;
        if (
          options?.minEnqueueTimeSec !== undefined &&
          timeSec < options.minEnqueueTimeSec
        ) {
          continue;
        }
        await this.pushDecodedFromNodeFrame(frame, timeSec, perFrameMs);
      }
    } finally {
      packet.free();
    }
  }

  /**
   * Random-access seek under previewDecodeMutex: isolated decode, then fresh playback context.
   */
  private async performPausedSeekLocked(targetSec: number): Promise<boolean> {
    const clamped = this.clampSourceTime(targetSec);
    const tolerance = RANDOM_ACCESS_TOLERANCE_SEC;

    const dropped = this.queue.flush();
    this.metrics.droppedFrames += dropped;
    this.pausedPollSequence = null;

    const hadFrameAtTarget =
      this.hasDisplayFrameNear(clamped, tolerance) && this.isSourceTimeBuffered(clamped);

    let actualTime = this.currentFrame?.timeSec ?? clamped;

    if (!hadFrameAtTarget) {
      await this.safeClosePlaybackContextLocked();
      const decoded = await decodeFrameAtRandomAccessLocked(
        this.metrics.file,
        clamped,
        tolerance,
        this.metadata?.durationSec ?? 0
      );
      if (!decoded.ok || !decoded.frame) {
        return false;
      }
      actualTime = decoded.actualTimeSec ?? decoded.frame.timeSec;
      if (Math.abs(actualTime - clamped) > tolerance) {
        return false;
      }
      this.frameSequence += 1;
      this.currentFrame = { ...decoded.frame, sequence: this.frameSequence };
    } else if (this.currentFrame) {
      actualTime = this.currentFrame.timeSec;
    } else {
      return false;
    }

    this.clock.seek(actualTime);
    this.noteDecodedSourceTime(actualTime);
    const playbackReady = await this.resetPlaybackContextAtLocked(actualTime);
    if (!playbackReady) {
      return false;
    }

    return this.hasDisplayFrameNear(clamped, tolerance);
  }

  private async performSeek(targetSec: number): Promise<void> {
    if (!this.demuxer || !this.videoStream) {
      return;
    }

    const wasPlaying = this.clock.isPlaying();
    await this.executeSeekHold(targetSec, {
      generation: ++this.seekGeneration,
      resumeIfWasPlaying: wasPlaying,
    });
  }

  private async decodeLoop(): Promise<void> {
    this.decodeRunning = true;
    try {
      while (this.running) {
        if (this.pendingSeekSec !== null && !this.seekInFlight) {
          const target = this.pendingSeekSec;
          this.pendingSeekSec = null;
          await this.performSeek(target);
          continue;
        }

        if (this.seekInFlight || this.nativeDecodeSuspended || !this.packetIterator) {
          await sleep(DECODE_IDLE_MS);
          continue;
        }

        const playing = this.clock.isPlaying();
        if (!playing) {
          if (this.enginePhase === "playing") {
            this.enginePhase = "paused";
          }
          await sleep(DECODE_IDLE_MS);
          continue;
        }

        if (this.enginePhase !== "playing" && this.enginePhase !== "buffering") {
          this.enginePhase = "playing";
        }

        const playhead = this.getPlaybackTargetSec();
        const latestQueued = this.queue.latestTimeSec();
        const decodeBehind =
          latestQueued === null || playhead - latestQueued > PLAYBACK_QUEUE_TOLERANCE_SEC;

        if (this.queue.length === 0 && !this.eof && !this.activeBufferingRange) {
          this.beginPreviewBufferingAt(playhead);
        }

        if (this.eof && this.queue.length === 0) {
          await sleep(DECODE_IDLE_MS);
          continue;
        }

        await previewDecodeMutex.runExclusive(async () => {
          while (
            this.running &&
            !this.seekInFlight &&
            !this.nativeDecodeSuspended &&
            this.packetIterator &&
            this.queue.length < MAX_QUEUE_SIZE &&
            !this.eof &&
            this.clock.isPlaying()
          ) {
            const step = await previewDecodeMutex.withReadingPacket(() =>
              this.packetIterator!.next()
            );
            if (step.done) {
              this.eof = true;
              break;
            }

            const packet = step.value as { free(): void } | null;
            if (!packet) {
              continue;
            }

            if (this.seekInFlight || this.nativeDecodeSuspended) {
              packet.free();
              break;
            }

            const decodeStart = performance.now();
            try {
              const frames = (await previewDecodeMutex.withDecodingPacket(() =>
                this.decoder.decodeAll(packet)
              )) as Array<{
                width: number;
                height: number;
                pts: bigint;
                pktDts: bigint;
                bestEffortTimestamp: bigint;
                timeBase: { num: number; den: number };
              }>;
              const decodeMs = performance.now() - decodeStart;

              for (const frame of frames) {
                if (!frame) {
                  continue;
                }

                const timeSec =
                  frameTimeSec(frame, this.videoStream!, this.metadata?.durationSec ?? 0) ??
                  this.clock.now();

                const perFrameMs = frames.length > 0 ? decodeMs / frames.length : decodeMs;
                this.recordDecodeMs(perFrameMs);
                this.metrics.decodedFrames += 1;

                await this.pushDecodedFromNodeFrame(frame, timeSec, perFrameMs);
              }
            } finally {
              packet.free();
            }
          }
        });

        if (this.queue.length >= MAX_QUEUE_SIZE && this.activeBufferingRange) {
          this.finalizePreviewBuffering();
        }

        if (!decodeBehind) {
          await sleep(DECODE_IDLE_MS);
        }
      }
    } finally {
      this.decodeRunning = false;
    }
  }

  private async displayLoop(): Promise<void> {
    this.displayRunning = true;
    try {
      while (this.running) {
        const tickStart = performance.now();
        if (this.clock.isPlaying()) {
          const frame = this.queue.popForTime(this.clock.now());
          if (frame) {
            this.metrics.displayedFrames += 1;
          } else if (!this.eof || this.queue.length > 0) {
            this.metrics.displayUnderruns += 1;
          }
        }

        const elapsed = performance.now() - tickStart;
        const waitMs = Math.max(0, DISPLAY_TICK_MS - elapsed);
        await sleep(waitMs);
      }
    } finally {
      this.displayRunning = false;
    }
  }

  private requestSeek(targetSec: number): void {
    this.pendingSeekSec = targetSec;
  }

  private startLoops(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.cpuStart = process.cpuUsage();
    void this.decodeLoop();
    void this.displayLoop();
  }

  private stopLoops(): void {
    this.running = false;
  }

  private finalizePlaybackWallSec(startMs: number): void {
    this.metrics.playbackWallSec += (performance.now() - startMs) / 1000;
  }

  async runPhase1Tests(): Promise<PlayerTestReport> {
    const tests = {
      play30s: false,
      seekForward5s: false,
      seekBackward5s: false,
      pauseResume: false,
    };

    if (!this.metadata) {
      return { metrics: this.getMetrics(), tests };
    }

    this.startLoops();

    try {
      this.clock.start(0);
      const playStart = performance.now();
      await sleep(30_000);
      this.finalizePlaybackWallSec(playStart);
      tests.play30s =
        this.metrics.decodedFrames > 0 &&
        this.metrics.displayedFrames > 0 &&
        this.metrics.demuxerReopenCount === 0;

      const afterPlay = this.clock.pause();
      this.requestSeek(afterPlay + 5);
      await this.waitForSeek();
      this.clock.resume();
      const seekFwdStart = performance.now();
      await sleep(2_000);
      this.clock.pause();
      this.finalizePlaybackWallSec(seekFwdStart);
      tests.seekForward5s = this.metrics.seekCount >= 1 && this.metrics.errors.length === 0;

      const backTarget = Math.max(0, this.clock.now() - 5);
      this.requestSeek(backTarget);
      await this.waitForSeek();
      this.clock.resume();
      const seekBackStart = performance.now();
      await sleep(2_000);
      this.clock.pause();
      this.finalizePlaybackWallSec(seekBackStart);
      tests.seekBackward5s = this.metrics.seekCount >= 2;

      const pauseStart = performance.now();
      const playheadBeforePause = this.clock.now();
      this.clock.pause();
      await sleep(2_000);
      const playheadWhilePaused = this.clock.now();
      this.clock.resume();
      await sleep(2_000);
      const playheadAfterResume = this.clock.now();
      this.clock.pause();
      this.finalizePlaybackWallSec(pauseStart);
      tests.pauseResume =
        Math.abs(playheadWhilePaused - playheadBeforePause) < 0.15 &&
        playheadAfterResume > playheadWhilePaused + 1.5;
    } catch (error) {
      this.metrics.errors.push(error instanceof Error ? error.message : String(error));
      this.metrics.sequentialDecodeOk = false;
    } finally {
      this.stopLoops();
      while (this.decodeRunning || this.displayRunning) {
        await sleep(5);
      }
    }

    return { metrics: this.getMetrics(), tests };
  }

  private async waitForSeek(): Promise<void> {
    const deadline = performance.now() + 10_000;
    while (performance.now() < deadline) {
      if (this.pendingSeekSec === null && !this.seekInFlight) {
        await sleep(50);
        return;
      }
      await sleep(10);
    }
    this.metrics.errors.push("Seek timed out");
    this.metrics.sequentialDecodeOk = false;
  }

  getResourceSnapshot(): {
    memoryRssMb: number;
    memoryHeapMb: number;
    cpuPercentEstimate: number | null;
  } {
    const memory = process.memoryUsage();
    const rssMb = memory.rss / (1024 * 1024);
    const heapMb = memory.heapUsed / (1024 * 1024);

    let cpuPercentEstimate: number | null = null;
    if (this.cpuStart && this.metrics.playbackWallSec > 0) {
      const cpuDelta = process.cpuUsage(this.cpuStart);
      const cpuMs = (cpuDelta.user + cpuDelta.system) / 1000;
      const cores = Math.max(1, cpus().length);
      cpuPercentEstimate = (cpuMs / (this.metrics.playbackWallSec * 1000)) / cores * 100;
    }

    return { memoryRssMb: rssMb, memoryHeapMb: heapMb, cpuPercentEstimate };
  }
}
