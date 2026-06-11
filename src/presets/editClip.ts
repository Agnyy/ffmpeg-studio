import type { FfmpegPreset } from "./presetTypes";
import type { PresetOptions } from "../shared/types";
import { buildEditClipArgs } from "../ffmpeg/editCommandBuilder";

function parseTime(value?: string): number {
  if (!value?.trim()) {
    return 0;
  }
  const trimmed = value.trim();
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map(Number);
    if (parts.some((part) => Number.isNaN(part))) {
      return 0;
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }
  const numeric = parseFloat(trimmed);
  return Number.isNaN(numeric) ? 0 : numeric;
}

export const editClip: FfmpegPreset = {
  id: "edit-clip",
  title: "Render Edited Clip",
  description: "Export the current trim and crop edits as a new MP4 file.",
  outputExtension: ".mp4",
  outputSuffix: "_edited",
  buildArgs: (inputPath, outputPath, options?: PresetOptions) => {
    if (options?.editClip) {
      return buildEditClipArgs(inputPath, outputPath, options.editClip);
    }

    const trimStart = parseTime(options?.trimStart);
    const trimDuration = parseTime(options?.trimDuration) || 10;

    return buildEditClipArgs(inputPath, outputPath, {
      trimStart,
      trimEnd: trimStart + trimDuration,
      cropEnabled: false,
      exportCrf: 23,
      exportPreset: "medium",
    });
  },
};
