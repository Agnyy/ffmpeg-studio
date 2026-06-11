import type { FfmpegPreset } from "./presetTypes";

export const extractAudio: FfmpegPreset = {
  id: "extract-audio",
  title: "Extract Audio",
  description: "Extract the audio track and save it as MP3.",
  outputExtension: ".mp3",
  outputSuffix: "_audio",
  buildArgs: (inputPath, outputPath) => [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-c:a",
    "libmp3lame",
    outputPath,
  ],
};
