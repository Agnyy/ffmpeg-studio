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

export function logRendererEngineFrame(frame: {
  width: number;
  height: number;
  rgba: Uint8Array;
}): void {
  console.log(
    [
      "[ENGINE_FRAME_RENDERER]",
      `width=${frame.width}`,
      `height=${frame.height}`,
      `rgbaLength=${frame.rgba.length}`,
      `checksum=${rgbaChecksum(frame.rgba)}`,
      `firstBytes=${rgbaFirstBytes(frame.rgba)}`,
    ].join(" ")
  );
}

export type EngineDrawResult = {
  ok: boolean;
  canvasWidth: number;
  canvasHeight: number;
  error?: string;
};

/** Force opaque alpha — node-av RGBA may ship with A=0. */
export function forceOpaqueAlpha(rgba: Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  out.set(rgba);
  for (let i = 3; i < out.length; i += 4) {
    out[i] = 255;
  }
  return out;
}

export function drawRgbaToCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  rgba: Uint8Array,
  options?: { forceAlpha?: boolean }
): EngineDrawResult {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { ok: false, canvasWidth: 0, canvasHeight: 0, error: "no 2d context" };
  }

  const expected = width * height * 4;
  if (rgba.length < expected) {
    return {
      ok: false,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      error: `rgba too short: ${rgba.length} < ${expected}`,
    };
  }

  canvas.width = width;
  canvas.height = height;

  const pixels =
    options?.forceAlpha !== false ? forceOpaqueAlpha(rgba) : new Uint8ClampedArray(rgba);
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixels.subarray(0, expected));
  ctx.putImageData(imageData, 0, 0);

  return { ok: true, canvasWidth: canvas.width, canvasHeight: canvas.height };
}
