import type { FfmpegPreset } from "./presetTypes";

const SCALE_MAP: Record<string, string> = {
  "1920x1080": "1920:1080",
  "1280x720": "1280:720",
  "1080x1080": "1080:1080",
  "1080x1920": "1080:1920",
};

export const resizeVideo: FfmpegPreset = {
  id: "resize-video",
  title: "Resize Video",
  description: "Resize video to a common resolution preset.",
  outputExtension: ".mp4",
  outputSuffix: "_resized",
  buildArgs: (inputPath, outputPath, options) => {
    const size = options?.resize ?? "1280x720";
    const scale = SCALE_MAP[size] ?? "1280:720";

    return [
      "-y",
      "-i",
      inputPath,
      "-vf",
      `scale=${scale}`,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      outputPath,
    ];
  },
};

export function getResizeOutputSuffix(size: string): string {
  return `_resized_${size}`;
}
