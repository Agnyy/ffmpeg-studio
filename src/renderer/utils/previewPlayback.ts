import type { ProjectItem, TimelineLayer } from "../../shared/project";
import {
  getLayerSourceTime,
  isLayerVisibleAtCompTime,
  isPrecompLayer,
  sourceTimeToCompTime,
} from "../../shared/project";
import { getLayerPreviewPlaybackState } from "../../media/mediaCompatibility";

export type PreviewSyncMode = "video-master" | "composition-clock" | "cache-master";

export function getVisibleVideoLayers(
  layers: TimelineLayer[],
  compTime: number
): TimelineLayer[] {
  return layers.filter(
    (layer) =>
      layer.enabled &&
      layer.hasVideo &&
      isLayerVisibleAtCompTime(layer, compTime)
  );
}

export function resolveMasterVideoLayer(
  layers: TimelineLayer[],
  compTime: number,
  projectItems: ProjectItem[]
): TimelineLayer | null {
  const visible = getVisibleVideoLayers(layers, compTime);
  if (visible.length !== 1) {
    return null;
  }
  const layer = visible[0];
  const footage = projectItems.find(
    (item) => item.type === "footage" && item.path === layer.sourcePath
  );
  if (!getLayerPreviewPlaybackState(footage).path) {
    return null;
  }
  return layer;
}

function isFootageVideoLayer(layer: TimelineLayer): boolean {
  return !isPrecompLayer(layer) && layer.hasVideo;
}

function footageSourcePath(
  layer: TimelineLayer,
  projectItems: ProjectItem[]
): string | null {
  const footage = projectItems.find(
    (item) =>
      item.type === "footage" &&
      (item.path === layer.sourcePath || item.originalPath === layer.sourcePath)
  );
  return footage?.originalPath ?? footage?.path ?? layer.sourcePath ?? null;
}

export function countFootageVideoLayers(layers: TimelineLayer[]): number {
  return layers.filter(isFootageVideoLayer).length;
}

/**
 * Node-av preview layer: original path only, no Chromium gate.
 * Single footage layer → always eligible; multi-layer → selected footage layer.
 */
export function resolveNodeAvPreviewLayer(
  layers: TimelineLayer[],
  compTime: number,
  projectItems: ProjectItem[],
  options?: { selectedLayerId?: string | null }
): TimelineLayer | null {
  const footageLayers = layers.filter(isFootageVideoLayer);
  if (footageLayers.length === 0) {
    return null;
  }

  if (footageLayers.length === 1) {
    const layer = footageLayers[0];
    return footageSourcePath(layer, projectItems) ? layer : null;
  }

  if (options?.selectedLayerId) {
    const selected = footageLayers.find((layer) => layer.id === options.selectedLayerId);
    if (selected && footageSourcePath(selected, projectItems)) {
      return selected;
    }
  }

  const visible = getVisibleVideoLayers(layers, compTime).filter(
    (layer) => !isPrecompLayer(layer)
  );
  if (visible.length === 1 && footageSourcePath(visible[0], projectItems)) {
    return visible[0];
  }

  return null;
}

export function canUseVideoMasterPlayback(
  layers: TimelineLayer[],
  compTime: number,
  projectItems: ProjectItem[],
  useCache: boolean
): boolean {
  if (useCache) {
    return false;
  }
  return resolveMasterVideoLayer(layers, compTime, projectItems) !== null;
}

export function compTimeFromVideoSourceTime(
  layer: TimelineLayer,
  videoCurrentTime: number
): number {
  return sourceTimeToCompTime(layer, videoCurrentTime);
}

export function videoSourceTimeFromCompTime(
  layer: TimelineLayer,
  compTime: number
): number | null {
  return getLayerSourceTime(layer, compTime);
}
