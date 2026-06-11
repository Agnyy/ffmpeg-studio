import type { FfmpegPreset } from "./presetTypes";

export const removeAudio: FfmpegPreset = {
  id: "remove-audio",
  title: "Remove Audio",
  description: "Copy video stream without re-encoding and remove audio.",
  outputExtension: ".mp4",
  outputSuffix: "_noaudio",
  buildArgs: (inputPath, outputPath) => [
    "-y",
    "-i",
    inputPath,
    "-c:v",
    "copy",
    "-an",
    outputPath,
  ],
};
