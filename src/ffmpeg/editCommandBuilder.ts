import type { EditClipOptions } from "../shared/clipEdit";
import type { LayerEffect } from "../shared/effects";
import type { LayerTransform } from "../shared/transform";
import {
  buildAudioEffectFilters,
  buildVideoEffectFilters,
} from "./effectFilters";

export function buildEditClipArgs(
  inputPath: string,
  outputPath: string,
  options: EditClipOptions
): string[] {
  if (usesCompositionRender(options)) {
    return buildCompositionRenderArgs(inputPath, outputPath, options);
  }

  const trimStart = Math.max(0, options.trimStart);
  const trimEnd = Math.max(trimStart + 0.01, options.trimEnd);
  const duration = trimEnd - trimStart;

  const args: string[] = ["-y"];

  if (trimStart > 0) {
    args.push("-ss", formatSeconds(trimStart));
  }

  args.push("-i", inputPath, "-t", formatSeconds(duration));

  if (options.cropEnabled && options.crop) {
    const { width, height, x, y } = options.crop;
    const w = Math.max(2, Math.round(width));
    const h = Math.max(2, Math.round(height));
    const cx = Math.max(0, Math.round(x));
    const cy = Math.max(0, Math.round(y));
    args.push("-vf", `crop=${w}:${h}:${cx}:${cy}`);
  }

  appendVideoAudioEncode(args, options);
  args.push(outputPath);
  return args;
}

function usesCompositionRender(options: EditClipOptions): boolean {
  return Boolean(
    options.transform &&
      options.compWidth &&
      options.compHeight &&
      options.compWidth > 0 &&
      options.compHeight > 0
  );
}

function buildCompositionRenderArgs(
  inputPath: string,
  outputPath: string,
  options: EditClipOptions
): string[] {
  const trimStart = Math.max(0, options.trimStart);
  const trimEnd = Math.max(trimStart + 0.01, options.trimEnd);
  const duration = trimEnd - trimStart;
  const compW = Math.max(2, Math.round(options.compWidth!));
  const compH = Math.max(2, Math.round(options.compHeight!));
  const transform = options.transform!;

  const effects = options.effects ?? [];
  const fgFilters = buildForegroundFilters(options, transform, effects);
  const overlayX = `${Math.round(transform.positionX)}-overlay_w*${transform.anchorX}`;
  const overlayY = `${Math.round(transform.positionY)}-overlay_h*${transform.anchorY}`;

  const filterParts = [
    `color=s=${compW}x${compH}:c=black:d=${formatSeconds(duration)}[bg]`,
    `[0:v]${fgFilters}[fg]`,
    `[bg][fg]overlay=x=${overlayX}:y=${overlayY},format=yuv420p[outv]`,
  ];

  const audioFilters = buildAudioEffectFilters(effects);
  if (!options.muted && audioFilters.length > 0) {
    filterParts.push(`[0:a]${audioFilters.join(",")}[outa]`);
  }

  const filterComplex = filterParts.join(";");

  const args: string[] = ["-y"];

  if (trimStart > 0) {
    args.push("-ss", formatSeconds(trimStart));
  }

  args.push("-i", inputPath, "-t", formatSeconds(duration));
  args.push("-filter_complex", filterComplex, "-map", "[outv]");

  if (options.muted) {
    args.push("-an");
  } else if (audioFilters.length > 0) {
    args.push("-map", "[outa]", "-c:a", "aac", "-b:a", "128k");
  } else {
    args.push("-map", "0:a?", "-c:a", "aac", "-b:a", "128k");
  }

  appendVideoEncodeOnly(args, options);
  args.push(outputPath);
  return args;
}

export function buildForegroundFilters(
  options: EditClipOptions,
  transform: LayerTransform,
  effects: NonNullable<EditClipOptions["effects"]>
): string {
  const parts: string[] = [];

  if (options.cropEnabled && options.crop) {
    const { width, height, x, y } = options.crop;
    parts.push(
      `crop=${Math.max(2, Math.round(width))}:${Math.max(2, Math.round(height))}:${Math.max(0, Math.round(x))}:${Math.max(0, Math.round(y))}`
    );
  }

  parts.push(`scale=iw*${(transform.scaleX / 100).toFixed(4)}:ih*${(transform.scaleY / 100).toFixed(4)}`);

  if (Math.abs(transform.rotation) > 0.01) {
    parts.push(`rotate=${transform.rotation}*PI/180:c=black@0`);
  }

  parts.push(...buildVideoEffectFilters(effects));

  if (transform.opacity < 99.99) {
    parts.push(`format=rgba,colorchannelmixer=aa=${(transform.opacity / 100).toFixed(4)}`);
  }

  return parts.join(",");
}

function appendVideoEncodeOnly(args: string[], options: EditClipOptions): void {
  const crf = options.exportCrf ?? 23;
  const preset = options.exportPreset ?? "medium";
  args.push("-c:v", "libx264", "-preset", preset, "-crf", String(crf));
}

function appendVideoAudioEncode(args: string[], options: EditClipOptions): void {
  appendVideoEncodeOnly(args, options);
  if (options.muted) {
    args.push("-an");
  } else {
    args.push("-c:a", "aac", "-b:a", "128k");
  }
}

function formatSeconds(value: number): string {
  return Number(value.toFixed(3)).toString();
}

export function buildEditClipOutputPath(inputPath: string): string {
  const separator = inputPath.includes("\\") ? "\\" : "/";
  const lastSep = Math.max(inputPath.lastIndexOf("/"), inputPath.lastIndexOf("\\"));
  const dir = lastSep >= 0 ? inputPath.slice(0, lastSep) : "";
  const filename = lastSep >= 0 ? inputPath.slice(lastSep + 1) : inputPath;
  const dot = filename.lastIndexOf(".");
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  const outputName = `${base}_edited.mp4`;
  return dir ? `${dir}${separator}${outputName}` : outputName;
}

export function clipEditToOptions(
  state: {
    trimStart: number;
    trimEnd: number;
    cropEnabled: boolean;
    crop?: { x: number; y: number; width: number; height: number };
    exportCrf: number;
    exportPreset: string;
  },
  extras?: { muted?: boolean }
): EditClipOptions {
  return {
    trimStart: state.trimStart,
    trimEnd: state.trimEnd,
    cropEnabled: state.cropEnabled,
    crop: state.crop,
    exportCrf: state.exportCrf,
    exportPreset: state.exportPreset,
    muted: extras?.muted,
  };
}

export function layerToEditOptions(
  state: {
    trimStart: number;
    trimEnd: number;
    cropEnabled: boolean;
    crop?: { x: number; y: number; width: number; height: number };
    exportCrf: number;
    exportPreset: string;
  },
  layer: {
    inPoint: number;
    outPoint: number;
    muted: boolean;
    transform: LayerTransform;
    effects?: LayerEffect[];
  },
  comp: { width: number; height: number },
  source: { width: number; height: number }
): EditClipOptions {
  return {
    trimStart: layer.inPoint,
    trimEnd: layer.outPoint,
    cropEnabled: state.cropEnabled,
    crop: state.crop,
    exportCrf: state.exportCrf,
    exportPreset: state.exportPreset,
    muted: layer.muted,
    transform: layer.transform,
    compWidth: comp.width,
    compHeight: comp.height,
    sourceWidth: source.width,
    sourceHeight: source.height,
    effects: layer.effects ?? [],
  };
}

export function layerToEditOptionsFromLayer(
  layer: {
    inPoint: number;
    outPoint: number;
    muted: boolean;
    cropEnabled?: boolean;
    crop?: { x: number; y: number; width: number; height: number };
    transform: LayerTransform;
    effects?: LayerEffect[];
  },
  comp: { width: number; height: number },
  source: { width: number; height: number },
  encoding: { exportCrf: number; exportPreset: string }
): EditClipOptions {
  return {
    trimStart: layer.inPoint,
    trimEnd: layer.outPoint,
    cropEnabled: layer.cropEnabled ?? false,
    crop: layer.crop,
    exportCrf: encoding.exportCrf,
    exportPreset: encoding.exportPreset,
    muted: layer.muted,
    transform: layer.transform,
    compWidth: comp.width,
    compHeight: comp.height,
    sourceWidth: source.width,
    sourceHeight: source.height,
    effects: layer.effects ?? [],
  };
}
