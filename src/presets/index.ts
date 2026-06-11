import { editClip } from "./editClip";
import { convertToMp4 } from "./convertToMp4";
import { compressForWeb } from "./compressForWeb";
import { removeAudio } from "./removeAudio";
import { extractAudio } from "./extractAudio";
import { resizeVideo } from "./resizeVideo";
import { trimVideo } from "./trimVideo";
import type { FfmpegPreset } from "./presetTypes";

export const presets: FfmpegPreset[] = [
  editClip,
  convertToMp4,
  compressForWeb,
  removeAudio,
  extractAudio,
  resizeVideo,
  trimVideo,
];

export function getPresetById(id: string): FfmpegPreset | undefined {
  return presets.find((preset) => preset.id === id);
}

export {
  editClip,
  convertToMp4,
  compressForWeb,
  removeAudio,
  extractAudio,
  resizeVideo,
  trimVideo,
};

export type { FfmpegPreset } from "./presetTypes";
