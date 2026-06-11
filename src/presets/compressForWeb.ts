import type { FfmpegPreset } from "./presetTypes";

export const compressForWeb: FfmpegPreset = {
  id: "compress-for-web",
  title: "Compress for Web",
  description: "Smaller MP4 suitable for web upload with balanced quality.",
  outputExtension: ".mp4",
  outputSuffix: "_web",
  buildArgs: (inputPath, outputPath) => [
    "-y",
    "-i",
    inputPath,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputPath,
  ],
};
