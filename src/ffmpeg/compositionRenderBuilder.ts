import type { CropRect, EditClipOptions } from "../shared/clipEdit";
import type { RenderRange } from "../shared/projectDocument";
import {
  getLayerVisibleSegmentInRenderRange,
  isPrecompLayer,
  layerCompEnd,
  type LayerVisibleSegment,
  type TimelineLayer,
} from "../shared/project";
import { joinPath, getDirname } from "../shared/pathUtils";
import {
  buildAudioEffectFilters,
  getEffectRenderWarnings,
} from "./effectFilters";
import type { LayerTransform } from "../shared/transform";
import { buildAnimatedForegroundFilters } from "./animatedForegroundBuilder";
import {
  buildAnimatedNumberExpression,
  hasAnimatedKeyframes,
} from "./keyframeExpressions";
import {
  analyzeCompositionRenderCompat,
  type CompositionRenderCompatReport,
} from "../keyframes/keyframeRenderCompat";
import { getEffectiveLayerTransform } from "../keyframes/layerTransformKeyframes";
import { layerToEditOptionsFromLayer } from "./editCommandBuilder";

function getLayerSourceSize(
  sourceWidth: number,
  sourceHeight: number,
  _crop?: CropRect,
  _cropEnabled?: boolean
): { width: number; height: number } {
  return { width: sourceWidth, height: sourceHeight };
}

function getTransformRenderWarnings(transform: LayerTransform): string[] {
  const warnings: string[] = [];
  if (transform.opacity < 100) {
    warnings.push("Opacity is applied in render via alpha channel.");
  }
  const normalized = ((transform.rotation % 360) + 360) % 360;
  if (normalized % 90 > 0.01 && normalized % 90 < 89.99) {
    warnings.push("Arbitrary rotation is enabled in preview and render.");
  }
  return warnings;
}

export type CompositionRenderRange = {
  mode: RenderRange;
  start: number;
  end: number;
};

export type CompositionRenderInput = {
  composition: {
    name: string;
    width: number;
    height: number;
    fps: number;
    duration: number;
    workAreaStart: number;
    workAreaEnd: number;
  };
  layers: TimelineLayer[];
  mediaInfoByPath: Record<string, { width?: number; height?: number }>;
  selectedLayerId: string | null;
  renderRange: RenderRange;
  outputPath: string;
  exportCrf: number;
  exportPreset: string;
  exportAudioBitrate?: string;
  /** Rendered intermediate mp4 per precomp layer id (parent render only). */
  precompSourceByLayerId?: Record<string, string>;
};

export type CompositionRenderResult = {
  args: string[];
  warnings: string[];
  range: CompositionRenderRange;
  renderDuration: number;
  videoLayerCount: number;
  audioLayerCount: number;
  renderLayers: TimelineLayer[];
  renderCompat: CompositionRenderCompatReport;
};

type PreparedLayerInput = {
  layer: TimelineLayer;
  segment: LayerVisibleSegment;
  editOptions: EditClipOptions;
  inputIndex: number;
};

export function resolveRenderRange(
  mode: RenderRange,
  composition: {
    duration: number;
    workAreaStart: number;
    workAreaEnd: number;
  },
  selectedLayer: TimelineLayer | null
): CompositionRenderRange {
  const safeDuration = Math.max(composition.duration, 0.1);

  if (mode === "workArea") {
    const start = Math.max(0, composition.workAreaStart);
    const end = Math.max(start + 0.01, composition.workAreaEnd);
    return { mode, start, end: Math.min(end, safeDuration) };
  }

  if (mode === "selectedLayer" && selectedLayer) {
    const start = selectedLayer.startTime;
    const end = layerCompEnd(selectedLayer);
    return { mode, start, end: Math.max(start + 0.01, end) };
  }

  return { mode: "full", start: 0, end: safeDuration };
}

export function buildCompositionOutputPath(
  compositionName: string,
  referencePath: string,
  outputDir?: string | null
): string {
  const dir = outputDir?.trim() || getDirname(referencePath);
  const safeName = compositionName.replace(/[<>:"/\\|?*]+/g, "_").trim() || "Composition";
  return joinPath(dir, `${safeName}_render.mp4`);
}

function formatSeconds(value: number): string {
  return Number(value.toFixed(3)).toString();
}

/** Bottom layer first (higher index), top layer last (index 1) — matches AE timeline z-order. */
export function sortLayersForCompositor(layers: TimelineLayer[]): TimelineLayer[] {
  return [...layers].sort((a, b) => b.index - a.index);
}

function buildLayerEditOptions(
  layer: TimelineLayer,
  comp: { width: number; height: number },
  mediaInfo: { width?: number; height?: number },
  encoding: { exportCrf: number; exportPreset: string }
): EditClipOptions {
  const source = getLayerSourceSize(
    mediaInfo.width ?? 1920,
    mediaInfo.height ?? 1080,
    layer.crop,
    layer.cropEnabled
  );

  return layerToEditOptionsFromLayer(layer, comp, source, encoding);
}

function buildBlackCompositionArgs(
  compW: number,
  compH: number,
  renderDuration: number,
  outputPath: string,
  exportCrf: number,
  exportPreset: string
): string[] {
  return [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=s=${compW}x${compH}:c=black:d=${formatSeconds(renderDuration)}`,
    "-vf",
    "format=yuv420p",
    "-t",
    formatSeconds(renderDuration),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    exportPreset,
    "-crf",
    String(exportCrf),
    outputPath,
  ];
}

function prepareLayerInputs(
  input: CompositionRenderInput,
  range: CompositionRenderRange,
  compW: number,
  compH: number,
  warnings: string[]
): PreparedLayerInput[] {
  const prepared: PreparedLayerInput[] = [];
  let inputIndex = 0;

  for (const layer of sortLayersForCompositor(input.layers)) {
    if (!layer.enabled) {
      continue;
    }

    const precompSource = isPrecompLayer(layer)
      ? input.precompSourceByLayerId?.[layer.id]
      : undefined;
    const sourcePath = precompSource ?? layer.sourcePath;

    if (!sourcePath) {
      if (isPrecompLayer(layer)) {
        warnings.push(
          `Precomp layer "${layer.name}" has no rendered intermediate — skipped.`
        );
      }
      continue;
    }

    if (isPrecompLayer(layer) && layer.hasAudio) {
      warnings.push(
        `Precomp layer "${layer.name}": Precomp audio is not supported yet.`
      );
    }

    const segment = getLayerVisibleSegmentInRenderRange(layer, range.start, range.end);
    if (!segment) {
      continue;
    }

    const participates =
      layer.hasVideo || (layer.hasAudio && !layer.muted);
    if (!participates) {
      continue;
    }

    if (!layer.hasVideo && layer.hasAudio && !layer.muted) {
      warnings.push(
        `Layer "${layer.name}" has audio only — included in audio mix.`
      );
    }

    const mediaInfo = input.mediaInfoByPath[sourcePath] ?? {};
    const editOptions = buildLayerEditOptions(
      layer,
      { width: compW, height: compH },
      mediaInfo,
      { exportCrf: input.exportCrf, exportPreset: input.exportPreset }
    );

    prepared.push({
      layer,
      segment,
      editOptions,
      inputIndex,
    });
    inputIndex += 1;
  }

  return prepared;
}

function buildMultiLayerFilterComplex(
  prepared: PreparedLayerInput[],
  compW: number,
  compH: number,
  renderDuration: number,
  renderStart: number,
  warnings: string[]
): { filterComplex: string; hasAudio: boolean } {
  const filterParts: string[] = [];
  filterParts.push(
    `color=s=${compW}x${compH}:c=black:d=${formatSeconds(renderDuration)}[base]`
  );

  const videoLayers = prepared.filter((entry) => entry.layer.hasVideo);
  let currentVideoLabel = "base";

  for (let i = 0; i < videoLayers.length; i++) {
    const { layer, segment, editOptions, inputIndex } = videoLayers[i];
    const segmentStartComp = renderStart + segment.overlayStart;
    const transformAtStart = getEffectiveLayerTransform(layer, segmentStartComp);
    const effects = layer.effects ?? [];
    const overlayStart = segment.overlayStart;
    const overlayEnd = overlayStart + segment.sourceDuration;

    const fgFilters = buildAnimatedForegroundFilters({
      layer,
      options: editOptions,
      effects,
      renderStart,
      overlayStart,
    });

    const layerLabel = `lv${i}`;
    const anchorX = layer.transform.anchorX;
    const anchorY = layer.transform.anchorY;

    const posXExpr = hasAnimatedKeyframes(layer.keyframes.positionX)
      ? `'${buildAnimatedNumberExpression({ keyframes: layer.keyframes.positionX, fallbackValue: layer.transform.positionX, renderStart, timeVariable: "t" })}-overlay_w*${anchorX}'`
      : `${Math.round(transformAtStart.positionX)}-overlay_w*${anchorX}`;
    const posYExpr = hasAnimatedKeyframes(layer.keyframes.positionY)
      ? `'${buildAnimatedNumberExpression({ keyframes: layer.keyframes.positionY, fallbackValue: layer.transform.positionY, renderStart, timeVariable: "t" })}-overlay_h*${anchorY}'`
      : `${Math.round(transformAtStart.positionY)}-overlay_h*${anchorY}`;

    filterParts.push(`[${inputIndex}:v]${fgFilters}[${layerLabel}]`);
    const nextLabel = `v${i}`;
    filterParts.push(
      `[${currentVideoLabel}][${layerLabel}]overlay=x=${posXExpr}:y=${posYExpr}:enable='between(t,${formatSeconds(overlayStart)},${formatSeconds(overlayEnd)})'[${nextLabel}]`
    );
    currentVideoLabel = nextLabel;

    warnings.push(...getTransformRenderWarnings(transformAtStart));
    warnings.push(...getEffectRenderWarnings(effects));
  }

  if (videoLayers.length === 0) {
    filterParts.push(`[base]format=yuv420p[vout]`);
  } else {
    filterParts.push(`[${currentVideoLabel}]format=yuv420p[vout]`);
  }

  const audioLayers = prepared.filter(
    (entry) => entry.layer.hasAudio && !entry.layer.muted
  );
  const audioLabels: string[] = [];

  for (let i = 0; i < audioLayers.length; i++) {
    const { layer, segment, inputIndex } = audioLayers[i];
    const audioFilters = buildAudioEffectFilters(layer.effects ?? [], {
      renderStart,
      timeVariable: `(${formatSeconds(segment.overlayStart)}+t)`,
    });
    const delayMs = Math.round(segment.overlayStart * 1000);
    const audioLabel = `la${i}`;
    const parts: string[] = [`[${inputIndex}:a]`];

    if (audioFilters.length > 0) {
      parts.push(audioFilters.join(","));
    }
    if (segment.overlayStart > 0.001) {
      parts.push(`adelay=${delayMs}|${delayMs}`);
      if (i === 0) {
        warnings.push("Audio start offset uses adelay for composition mix.");
      }
    }
    parts.push(`apad=whole_dur=${formatSeconds(renderDuration)}`);
    filterParts.push(`${parts.join(",")}[${audioLabel}]`);
    audioLabels.push(`[${audioLabel}]`);
  }

  if (audioLabels.length === 1) {
    filterParts.push(`${audioLabels[0]}anull[aout]`);
  } else if (audioLabels.length > 1) {
    filterParts.push(
      `${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=longest:normalize=0[aout]`
    );
    warnings.push("Multi-layer audio mix uses amix (simplified MVP).");
  }

  return {
    filterComplex: filterParts.join(";"),
    hasAudio: audioLabels.length > 0,
  };
}

export function buildCompositionRenderArgs(
  input: CompositionRenderInput
): CompositionRenderResult {
  const warnings: string[] = [];
  const compW = Math.max(2, Math.round(input.composition.width));
  const compH = Math.max(2, Math.round(input.composition.height));

  const selectedLayer =
    input.layers.find((layer) => layer.id === input.selectedLayerId) ?? null;

  const range = resolveRenderRange(
    input.renderRange,
    {
      duration: input.composition.duration,
      workAreaStart: input.composition.workAreaStart,
      workAreaEnd: input.composition.workAreaEnd,
    },
    selectedLayer
  );

  const renderDuration = Math.max(0.01, range.end - range.start);
  const renderCompat = analyzeCompositionRenderCompat(input.layers);
  const prepared = prepareLayerInputs(input, range, compW, compH, warnings);

  for (const entry of renderCompat.limitedEntries) {
    warnings.push(
      `Layer "${entry.layerName}": animated ${entry.label} is preview-only — render uses value at range start.`
    );
  }
  const videoLayers = prepared.filter((entry) => entry.layer.hasVideo);
  const audioLayers = prepared.filter(
    (entry) => entry.layer.hasAudio && !entry.layer.muted
  );

  if (videoLayers.length === 0 && audioLayers.length === 0) {
    warnings.push("No visible layers in render range — exporting black composition.");
    return {
      args: buildBlackCompositionArgs(
        compW,
        compH,
        renderDuration,
        input.outputPath,
        input.exportCrf,
        input.exportPreset
      ),
      warnings,
      range,
      renderDuration,
      videoLayerCount: 0,
      audioLayerCount: 0,
      renderLayers: [],
      renderCompat,
    };
  }

  const { filterComplex, hasAudio } = buildMultiLayerFilterComplex(
    prepared,
    compW,
    compH,
    renderDuration,
    range.start,
    warnings
  );

  const args: string[] = ["-y"];

  for (const entry of prepared) {
    if (entry.segment.sourceStart > 0) {
      args.push("-ss", formatSeconds(entry.segment.sourceStart));
    }
    const inputPath =
      (isPrecompLayer(entry.layer)
        ? input.precompSourceByLayerId?.[entry.layer.id]
        : undefined) ?? entry.layer.sourcePath;
    args.push("-i", inputPath);
    args.push("-t", formatSeconds(entry.segment.sourceDuration));
  }

  args.push("-filter_complex", filterComplex);
  args.push("-map", "[vout]");
  args.push("-t", formatSeconds(renderDuration));

  if (hasAudio) {
    args.push(
      "-map",
      "[aout]",
      "-c:a",
      "aac",
      "-b:a",
      input.exportAudioBitrate ?? "128k"
    );
  } else {
    args.push("-an");
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    input.exportPreset,
    "-crf",
    String(input.exportCrf),
    input.outputPath
  );

  const uniqueWarnings = [...new Set(warnings)];

  return {
    args,
    warnings: uniqueWarnings,
    range,
    renderDuration,
    videoLayerCount: videoLayers.length,
    audioLayerCount: audioLayers.length,
    renderLayers: prepared.map((entry) => entry.layer),
    renderCompat,
  };
}

export function formatRenderRangeLabel(range: CompositionRenderRange): string {
  const modeLabel =
    range.mode === "full"
      ? "Full Composition"
      : range.mode === "workArea"
        ? "Work Area"
        : "Selected Layer";
  return `${modeLabel}: ${formatSeconds(range.start)}s – ${formatSeconds(range.end)}s`;
}
