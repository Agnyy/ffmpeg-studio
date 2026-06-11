import type { FfmpegPreset } from "./presetTypes";

export const convertToMp4: FfmpegPreset = {
  id: "convert-to-mp4",
  title: "Convert to MP4",
  description: "Re-encode video to H.264 and audio to AAC in an MP4 container.",
  outputExtension: ".mp4",
  outputSuffix: "_converted",
  buildArgs: (inputPath, outputPath) => [
    "-y",
    "-i",
    inputPath,
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    outputPath,
  ],
};
