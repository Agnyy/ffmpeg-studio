import type { FfmpegPreset } from "./presetTypes";

export const trimVideo: FfmpegPreset = {
  id: "trim-video",
  title: "Trim Video",
  description: "Cut a segment from the video using start time and duration.",
  outputExtension: ".mp4",
  outputSuffix: "_trimmed",
  buildArgs: (inputPath, outputPath, options) => {
    const start = options?.trimStart?.trim() || "0";
    const duration = options?.trimDuration?.trim() || "10";

    return [
      "-y",
      "-ss",
      start,
      "-i",
      inputPath,
      "-t",
      duration,
      "-c",
      "copy",
      outputPath,
    ];
  },
};
