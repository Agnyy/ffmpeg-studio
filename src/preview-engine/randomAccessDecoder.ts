import { frameTimeSec } from "./frameTime";
import { loadNodeAvApi } from "./nodeAvLoader";
import { previewDecodeMutex } from "./previewDecodeMutex";
import { getPreviewDecoderCreateOptions } from "./previewDecoderConfig";
import {
  AVSEEK_FLAG_BACKWARD,
  GLOBAL_SEEK_STREAM_INDEX,
} from "./nodeAvConstants";
import type { QueuedVideoFrame } from "./types";

const MAX_PREVIEW_WIDTH = 1280;
const MAX_DECODE_PACKETS = 12_000;

export type RandomAccessDecodeResult = {
  ok: boolean;
  frame?: Omit<QueuedVideoFrame, "sequence">;
  actualTimeSec?: number;
  error?: string;
};

function resizeForFrame(frame: { width: number; height: number }):
  | { width: number; height: number }
  | undefined {
  if (frame.width <= MAX_PREVIEW_WIDTH) {
    return undefined;
  }
  return {
    width: MAX_PREVIEW_WIDTH,
    height: Math.max(2, Math.round((MAX_PREVIEW_WIDTH / frame.width) * frame.height)),
  };
}

type NodeVideoFrame = {
  width: number;
  height: number;
  pts: bigint;
  pktDts: bigint;
  bestEffortTimestamp: bigint;
  timeBase: { num: number; den: number };
};

/**
 * Decode one display frame near targetSec using a fresh demuxer/decoder.
 * Caller must already hold previewDecodeMutex (no parallel playback decoder).
 */
export async function decodeFrameAtRandomAccessLocked(
  filePath: string,
  targetSec: number,
  toleranceSec = 1.5,
  durationHintSec = 0
): Promise<RandomAccessDecodeResult> {
  const clamped = Math.max(0, targetSec);
  const { Demuxer, Decoder, Scaler, probe } = await loadNodeAvApi();
  const decoderOptions = await getPreviewDecoderCreateOptions();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let demuxer: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let decoder: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scaler: any = null;

  try {
    const probeInfo = await probe(filePath);
    const durationSec =
      durationHintSec > 0
        ? durationHintSec
        : probeInfo.duration > 0
          ? probeInfo.duration
          : clamped + 120;

    demuxer = await Demuxer.open(filePath);
    const videoStream = demuxer.video();
    if (!videoStream) {
      return { ok: false, error: "No video stream found" };
    }

    decoder = await Decoder.create(videoStream, decoderOptions as never);
    scaler = new Scaler();

    let seekResult = await demuxer.seek(
      clamped,
      GLOBAL_SEEK_STREAM_INDEX,
      AVSEEK_FLAG_BACKWARD
    );
    if (seekResult < 0) {
      seekResult = await demuxer.seek(0, GLOBAL_SEEK_STREAM_INDEX, AVSEEK_FLAG_BACKWARD);
      if (seekResult < 0) {
        return { ok: false, error: `Demuxer seek failed (${seekResult})` };
      }
    }

    const iterator = demuxer.packets(videoStream.index)[Symbol.asyncIterator]();
    let bestFrame: Omit<QueuedVideoFrame, "sequence"> | null = null;
    const epsilon = 0.05;

    for (let attempt = 0; attempt < MAX_DECODE_PACKETS; attempt++) {
      const step = (await previewDecodeMutex.withReadingPacket(() =>
        iterator.next()
      )) as IteratorResult<unknown, unknown>;
      if (step.done) {
        break;
      }

      const packet = step.value as { free(): void } | null;
      if (!packet) {
        continue;
      }

      const decodeStart = performance.now();
      try {
        const frames = (await previewDecodeMutex.withDecodingPacket(() =>
          decoder.decodeAll(packet)
        )) as NodeVideoFrame[];
        const decodeMs = performance.now() - decodeStart;

        for (const frame of frames) {
          if (!frame) {
            continue;
          }

          const timeSec =
            frameTimeSec(frame, videoStream, durationSec) ?? clamped;
          const resize = resizeForFrame(frame);
          const rgbaBuffer = await previewDecodeMutex.withScalingFrame(() =>
            scaler.toBuffer(frame as never, {
              format: "rgba",
              resize,
            })
          );
          const outWidth = resize?.width ?? frame.width;
          const outHeight = resize?.height ?? frame.height;
          const perFrameMs = frames.length > 0 ? decodeMs / frames.length : decodeMs;
          const queued: Omit<QueuedVideoFrame, "sequence"> = {
            timeSec,
            width: outWidth,
            height: outHeight,
            decodeMs: perFrameMs,
            rgba: Uint8Array.from(rgbaBuffer as ArrayLike<number>),
          };

          if (
            !bestFrame ||
            Math.abs(queued.timeSec - clamped) < Math.abs(bestFrame.timeSec - clamped)
          ) {
            bestFrame = queued;
          }

          if (timeSec + epsilon >= clamped && Math.abs(timeSec - clamped) <= toleranceSec) {
            return {
              ok: true,
              frame: queued,
              actualTimeSec: timeSec,
            };
          }
        }
      } finally {
        packet.free();
      }
    }

    if (bestFrame && Math.abs(bestFrame.timeSec - clamped) <= toleranceSec) {
      return {
        ok: true,
        frame: bestFrame,
        actualTimeSec: bestFrame.timeSec,
      };
    }

    return {
      ok: false,
      error: `No frame within ${toleranceSec.toFixed(1)}s of ${clamped.toFixed(3)}s`,
      actualTimeSec: bestFrame?.timeSec,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (decoder) {
      try {
        await decoder.flush();
      } catch {
        // ignore
      }
      decoder[Symbol.dispose]?.();
    }
    scaler?.[Symbol.dispose]?.();
    if (demuxer) {
      await demuxer.close();
    }
  }
}

/**
 * Random-access decode entry point — acquires the global FFmpeg mutex.
 */
export async function decodeFrameAtRandomAccess(
  filePath: string,
  targetSec: number,
  toleranceSec = 1.5,
  durationHintSec = 0
): Promise<RandomAccessDecodeResult> {
  return previewDecodeMutex.runExclusive(() =>
    decodeFrameAtRandomAccessLocked(filePath, targetSec, toleranceSec, durationHintSec)
  );
}
