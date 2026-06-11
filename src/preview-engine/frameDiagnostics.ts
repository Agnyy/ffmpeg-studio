export function rgbaChecksum(rgba: Uint8Array, sampleBytes = 4096): number {
  const limit = Math.min(rgba.length, sampleBytes);
  let sum = 0;
  for (let i = 0; i < limit; i += 1) {
    sum += rgba[i]!;
  }
  return sum;
}

export function rgbaFirstBytes(rgba: Uint8Array, count = 8): string {
  const limit = Math.min(rgba.length, count);
  const parts: string[] = [];
  for (let i = 0; i < limit; i += 1) {
    parts.push(rgba[i]!.toString(16).padStart(2, "0"));
  }
  return parts.join(" ");
}

export function expectedRgbaLength(width: number, height: number): number {
  return width * height * 4;
}

import { isEnginePreviewDevDiagEnabled } from "../shared/ffmpegLogFilter";

export function logMainEngineFrame(frame: {
  width: number;
  height: number;
  rgba: Uint8Array;
  timeSec: number;
}): void {
  if (!isEnginePreviewDevDiagEnabled()) {
    return;
  }

  const expected = expectedRgbaLength(frame.width, frame.height);
  console.log(
    [
      "[ENGINE_FRAME_MAIN]",
      `width=${frame.width}`,
      `height=${frame.height}`,
      `rgbaLength=${frame.rgba.length}`,
      `expected=${expected}`,
      `checksum=${rgbaChecksum(frame.rgba)}`,
      `firstBytes=${rgbaFirstBytes(frame.rgba)}`,
      `pts=${frame.timeSec.toFixed(3)}`,
    ].join(" ")
  );
  if (frame.rgba.length !== expected) {
    console.warn(
      `[ENGINE_FRAME_MAIN] rgba length mismatch: got ${frame.rgba.length}, expected ${expected}`
    );
  }
}
