import type { CropAspectRatio, CropRect } from "./clipEdit";
import type { LayerEffect } from "./effects";
import {
  createDefaultLayerKeyframes,
  type AnimatedProperty,
  type LayerKeyframes,
} from "../keyframes/keyframeTypes";
import { sanitizeEffectParamKeyframes } from "../keyframes/effectKeyframes";
import { cloneEffectParamKeyframes, ensureEffectKeyframes } from "../keyframes/layerEffectKeyframes";
import { cloneKeyframesProperty, sanitizeKeyframeProperty } from "../keyframes/keyframeUtils";
import type { MediaInfo } from "./types";
import {
  createDefaultTransform,
  type LayerTransform,
} from "./transform";

export type { LayerEffect, LayerEffectType } from "./effects";
export type { LayerTransform };
export { createDefaultTransform };

export type ProjectItemType = "footage" | "composition";

export type CompositionMeta = {
  width: number;
  height: number;
  fps: number;
  duration: number;
};

import type { MediaCompatibilityStatus } from "../media/mediaCompatibility";
import type { ThumbnailStatus } from "../media/thumbnailStatus";

export type ProjectItem = {
  id: string;
  type: ProjectItemType;
  name: string;
  path?: string;
  originalPath?: string;
  missing?: boolean;
  mediaInfo?: MediaInfo;
  composition?: CompositionMeta;
  thumbnailUrl?: string;
  thumbnailDataUrl?: string;
  thumbnailStatus?: ThumbnailStatus;
  previewPath?: string;
  proxyPath?: string;
  compatibilityStatus?: MediaCompatibilityStatus;
  compatibilityReason?: string;
  chromiumPreviewAllowed?: boolean;
  chromiumPreviewBlockedReason?: string;
  /** Set only after a successful manual or import Chromium preview test. */
  chromiumPreviewVerified?: boolean;
  previewAttempted?: boolean;
  lastPreviewCheckAt?: string;
};

export type TimelineLayerKind = "footage" | "precomp";

export type TimelineLayer = {
  id: string;
  layerKind?: TimelineLayerKind;
  sourceCompositionId?: string;
  sourceItemId: string;
  name: string;
  sourcePath: string;
  index: number;
  startTime: number;
  inPoint: number;
  outPoint: number;
  enabled: boolean;
  locked: boolean;
  muted: boolean;
  solo: boolean;
  collapsed: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  cropEnabled: boolean;
  crop?: CropRect;
  aspectRatio: CropAspectRatio;
  uniformScale: boolean;
  transform: LayerTransform;
  effects: LayerEffect[];
  keyframes: LayerKeyframes;
  transformExpanded?: boolean;
  audioExpanded?: boolean;
  cropExpanded?: boolean;
};

export function ensureLayerEditDefaults(layer: TimelineLayer): TimelineLayer {
  return ensureLayerKeyframes({
    ...layer,
    cropEnabled: layer.cropEnabled ?? false,
    aspectRatio: layer.aspectRatio ?? "free",
    uniformScale: layer.uniformScale ?? true,
    effects: layer.effects ?? [],
  });
}

function sanitizeLayerKeyframes(keyframes: LayerKeyframes): LayerKeyframes {
  const sanitize = (property: AnimatedProperty<number>) =>
    sanitizeKeyframeProperty(property);
  return {
    positionX: sanitize(keyframes.positionX),
    positionY: sanitize(keyframes.positionY),
    scaleX: sanitize(keyframes.scaleX),
    scaleY: sanitize(keyframes.scaleY),
    rotation: sanitize(keyframes.rotation),
    opacity: sanitize(keyframes.opacity),
  };
}

export function ensureLayerKeyframes(layer: TimelineLayer): TimelineLayer {
  if (!layer.keyframes) {
    return { ...layer, keyframes: createDefaultLayerKeyframes() };
  }
  return { ...layer, keyframes: sanitizeLayerKeyframes(layer.keyframes) };
}

export function cloneLayerEditFields(
  layer: TimelineLayer
): Pick<
  TimelineLayer,
  | "transform"
  | "crop"
  | "effects"
  | "keyframes"
  | "cropEnabled"
  | "aspectRatio"
  | "uniformScale"
> {
  const keyframes = layer.keyframes ?? createDefaultLayerKeyframes();
  return {
    transform: structuredClone(layer.transform),
    crop: layer.crop ? structuredClone(layer.crop) : undefined,
    effects: (layer.effects ?? []).map((effect) => ({
      ...effect,
      params: { ...effect.params },
      keyframes: cloneEffectParamKeyframes(effect),
    })),
    keyframes: {
      positionX: cloneKeyframesProperty(keyframes.positionX),
      positionY: cloneKeyframesProperty(keyframes.positionY),
      scaleX: cloneKeyframesProperty(keyframes.scaleX),
      scaleY: cloneKeyframesProperty(keyframes.scaleY),
      rotation: cloneKeyframesProperty(keyframes.rotation),
      opacity: cloneKeyframesProperty(keyframes.opacity),
    },
    cropEnabled: layer.cropEnabled ?? false,
    aspectRatio: layer.aspectRatio ?? "free",
    uniformScale: layer.uniformScale ?? true,
  };
}

/** @deprecated Use TimelineLayer */
export type TimelineTrack = "video" | "audio";

/** @deprecated Use TimelineLayer */
export type TimelineClip = {
  id: string;
  projectItemId: string;
  sourcePath: string;
  name: string;
  track: TimelineTrack;
  timelineStart: number;
  duration: number;
};

export type ImportSource = "dialog" | "window-drop" | "timeline-drop" | "project-drop";

export function createProjectId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureLayerTransform(
  layer: TimelineLayer,
  compositionWidth: number,
  compositionHeight: number
): TimelineLayer {
  let next = layer;
  if (!layer.transform) {
    next = {
      ...next,
      transform: createDefaultTransform(compositionWidth, compositionHeight),
    };
  }
  return ensureLayerKeyframes(ensureLayerEffects(next));
}

function normalizeVidstabEffect(effect: import("./effects").LayerEffect): import("./effects").LayerEffect {
  if (effect.type !== "vidstab") {
    return effect;
  }
  const status = String(effect.params.analysisStatus ?? "none");
  const analysisPath = String(effect.params.analysisPath ?? "");
  if (status === "ready" && !analysisPath) {
    return {
      ...effect,
      params: { ...effect.params, analysisStatus: "none" },
    };
  }
  return effect;
}

export function ensureLayerEffects(layer: TimelineLayer): TimelineLayer {
  if (!Array.isArray(layer.effects)) {
    return { ...layer, effects: [] };
  }
  return {
    ...layer,
    effects: layer.effects.map((effect) => {
      const normalized = normalizeVidstabEffect(effect);
      const ensured = ensureEffectKeyframes(normalized);
      return {
        ...ensured,
        keyframes: sanitizeEffectParamKeyframes(normalized.type, ensured.keyframes),
      };
    }),
  };
}

export function markMissingVidstabAnalysis(
  layers: TimelineLayer[],
  existingPaths: Record<string, boolean>
): TimelineLayer[] {
  return layers.map((layer) => ({
    ...layer,
    effects: (layer.effects ?? []).map((effect) => {
      if (effect.type !== "vidstab") {
        return effect;
      }
      const analysisPath = String(effect.params.analysisPath ?? "");
      if (
        String(effect.params.analysisStatus ?? "none") === "ready" &&
        analysisPath &&
        existingPaths[analysisPath] === false
      ) {
        return {
          ...effect,
          params: { ...effect.params, analysisStatus: "missing" },
        };
      }
      return effect;
    }),
  }));
}

export function createCompositionItem(mediaInfo?: MediaInfo, name = "Comp 1"): ProjectItem {
  return {
    id: createProjectId("comp"),
    type: "composition",
    name,
    composition: {
      width: mediaInfo?.width ?? 1280,
      height: mediaInfo?.height ?? 720,
      fps: mediaInfo?.fps ?? 30,
      duration: mediaInfo?.durationSeconds ?? 10,
    },
  };
}

export function updateCompositionDuration(
  item: ProjectItem,
  duration: number
): ProjectItem {
  if (item.type !== "composition" || !item.composition) {
    return item;
  }
  return {
    ...item,
    composition: {
      ...item.composition,
      duration: Math.max(item.composition.duration, duration),
    },
  };
}

export function layerDuration(layer: TimelineLayer): number {
  return Math.max(0.001, layer.outPoint - layer.inPoint);
}

export function layerCompEnd(layer: TimelineLayer): number {
  return layer.startTime + layerDuration(layer);
}

export function createPrecompLayer(
  compositionItem: ProjectItem,
  index: number,
  compositionWidth: number,
  compositionHeight: number,
  startTime: number,
  duration: number
): TimelineLayer {
  const safeDuration = Math.max(duration, 0.1);
  return {
    id: createProjectId("layer"),
    layerKind: "precomp",
    sourceCompositionId: compositionItem.id,
    sourceItemId: compositionItem.id,
    name: compositionItem.name,
    sourcePath: "",
    index,
    startTime,
    inPoint: 0,
    outPoint: safeDuration,
    enabled: true,
    locked: false,
    muted: false,
    solo: false,
    collapsed: true,
    hasVideo: true,
    hasAudio: false,
    cropEnabled: false,
    aspectRatio: "free",
    uniformScale: true,
    transform: createDefaultTransform(compositionWidth, compositionHeight),
    effects: [],
    keyframes: createDefaultLayerKeyframes(),
  };
}

export function isPrecompLayer(layer: TimelineLayer): boolean {
  return layer.layerKind === "precomp" || Boolean(layer.sourceCompositionId);
}

export function createTimelineLayer(
  sourceItemId: string,
  sourcePath: string,
  name: string,
  sourceDuration: number,
  index: number,
  compositionWidth: number,
  compositionHeight: number,
  startTime = 0
): TimelineLayer {
  const duration = Math.max(sourceDuration, 0.1);
  return {
    id: createProjectId("layer"),
    sourceItemId,
    name,
    sourcePath,
    index,
    startTime,
    inPoint: 0,
    outPoint: duration,
    enabled: true,
    locked: false,
    muted: false,
    solo: false,
    collapsed: true,
    hasVideo: true,
    hasAudio: true,
    cropEnabled: false,
    aspectRatio: "free",
    uniformScale: true,
    transform: createDefaultTransform(compositionWidth, compositionHeight),
    effects: [],
    keyframes: createDefaultLayerKeyframes(),
  };
}

export function reindexLayers(layers: TimelineLayer[]): TimelineLayer[] {
  return layers.map((layer, idx) => ({ ...layer, index: idx + 1 }));
}

export function compTimeToSourceTime(layer: TimelineLayer, compTime: number): number {
  return layer.inPoint + (compTime - layer.startTime);
}

/** Returns source media time, or null if comp playhead is outside the layer block. */
export function getLayerSourceTime(
  layer: TimelineLayer,
  compTime: number
): number | null {
  const duration = layerDuration(layer);
  const layerStart = layer.startTime;
  const layerEnd = layerStart + duration;

  if (compTime < layerStart - 0.0001 || compTime > layerEnd + 0.0001) {
    return null;
  }

  return layer.inPoint + (compTime - layerStart);
}

export function isLayerVisibleAtCompTime(
  layer: TimelineLayer,
  compTime: number
): boolean {
  return getLayerSourceTime(layer, compTime) !== null;
}

export function sourceTimeToCompTime(layer: TimelineLayer, sourceTime: number): number {
  return layer.startTime + (sourceTime - layer.inPoint);
}

export type LayerVisibleSegment = {
  visibleStart: number;
  visibleEnd: number;
  sourceStart: number;
  sourceDuration: number;
  overlayStart: number;
};

/** Maps a layer block to the portion visible inside a composition render window. */
export function getLayerVisibleSegmentInRenderRange(
  layer: TimelineLayer,
  renderStart: number,
  renderEnd: number
): LayerVisibleSegment | null {
  const duration = layerDuration(layer);
  const layerCompStart = layer.startTime;
  const layerCompEnd = layerCompStart + duration;

  const visibleStart = Math.max(layerCompStart, renderStart);
  const visibleEnd = Math.min(layerCompEnd, renderEnd);

  if (visibleEnd <= visibleStart + 0.0001) {
    return null;
  }

  const sourceStart = layer.inPoint + (visibleStart - layerCompStart);
  const sourceDuration = visibleEnd - visibleStart;
  const overlayStart = visibleStart - renderStart;

  return {
    visibleStart,
    visibleEnd,
    sourceStart,
    sourceDuration,
    overlayStart,
  };
}
