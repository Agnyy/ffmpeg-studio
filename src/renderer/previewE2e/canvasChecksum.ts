import { rgbaChecksum } from "../components/preview-engine/engineCanvasDraw";

const SAMPLE_SIZE = 64;

export function canvasChecksum(canvas: HTMLCanvasElement | null): number {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
    return 0;
  }
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return 0;
    }
    const sampleW = Math.min(SAMPLE_SIZE, canvas.width);
    const sampleH = Math.min(SAMPLE_SIZE, canvas.height);
    const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
    return rgbaChecksum(Uint8Array.from(imageData.data));
  } catch {
    return 0;
  }
}
