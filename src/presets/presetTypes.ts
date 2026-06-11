import type { PresetOptions } from "../shared/types";

export type FfmpegPreset = {
  id: string;
  title: string;
  description: string;
  buildArgs: (
    inputPath: string,
    outputPath: string,
    options?: PresetOptions
  ) => string[];
  outputExtension: string;
  outputSuffix: string;
};
