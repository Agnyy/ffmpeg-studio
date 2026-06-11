export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropAspectRatio = "free" | "16:9" | "9:16" | "1:1" | "4:3";

import type { LayerEffect } from "./effects";
import type { LayerTransform } from "./transform";

export type ClipEditState = {
  trimStart: number;
  trimEnd: number;
  currentTime: number;
  cropEnabled: boolean;
  crop?: CropRect;
  aspectRatio: CropAspectRatio;
  exportCrf: number;
  exportPreset: string;
  uniformScale: boolean;
};

export type EditClipOptions = {
  trimStart: number;
  trimEnd: number;
  cropEnabled: boolean;
  crop?: CropRect;
  exportCrf?: number;
  exportPreset?: string;
  muted?: boolean;
  transform?: LayerTransform;
  compWidth?: number;
  compHeight?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  effects?: LayerEffect[];
};

export function createDefaultClipEditState(durationSeconds: number): ClipEditState {
  const duration = Math.max(durationSeconds, 0.1);
  return {
    trimStart: 0,
    trimEnd: duration,
    currentTime: 0,
    cropEnabled: false,
    aspectRatio: "free",
    exportCrf: 23,
    exportPreset: "medium",
    uniformScale: true,
  };
}

export function createDefaultCrop(videoWidth: number, videoHeight: number): CropRect {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, Math.round(videoWidth)),
    height: Math.max(1, Math.round(videoHeight)),
  };
}
