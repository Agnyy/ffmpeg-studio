import {
  cloneLayerEditFields,
  createProjectId,
  createTimelineLayer,
  layerCompEnd,
  layerDuration,
  reindexLayers,
  type TimelineLayer,
} from "../../shared/project";
import type { LayerEffect } from "../../shared/effects";
import { cloneEffectParamKeyframes } from "../../keyframes/layerEffectKeyframes";

function cloneEffects(effects: LayerEffect[]): LayerEffect[] {
  return effects.map((effect) => ({
    ...effect,
    id: createProjectId("effect"),
    params: { ...effect.params },
    keyframes: cloneEffectParamKeyframes(effect),
  }));
}

export function duplicateTimelineLayer(layer: TimelineLayer): TimelineLayer {
  const editFields = cloneLayerEditFields(layer);
  return {
    ...layer,
    id: createProjectId("layer"),
    name: `${layer.name} copy`,
    ...editFields,
    effects: cloneEffects(layer.effects ?? []),
  };
}

export function moveLayerStartToPlayhead(
  layer: TimelineLayer,
  currentTime: number
): Partial<TimelineLayer> | null {
  if (Math.abs(layer.startTime - currentTime) < 0.001) {
    return null;
  }
  return { startTime: Math.max(0, currentTime) };
}

export function moveLayerEndToPlayhead(
  layer: TimelineLayer,
  currentTime: number
): Partial<TimelineLayer> | null {
  const duration = layerDuration(layer);
  const nextStart = Math.max(0, currentTime - duration);
  if (Math.abs(layer.startTime - nextStart) < 0.001) {
    return null;
  }
  return { startTime: nextStart };
}

export function trimLayerInToPlayhead(
  layer: TimelineLayer,
  currentTime: number
): Partial<TimelineLayer> | null {
  const delta = currentTime - layer.startTime;
  const dur = layerDuration(layer);
  if (delta <= 0 || delta >= dur - 0.001) {
    return null;
  }
  return {
    startTime: currentTime,
    inPoint: layer.inPoint + delta,
  };
}

export function trimLayerOutToPlayhead(
  layer: TimelineLayer,
  currentTime: number,
  minDuration: number
): Partial<TimelineLayer> | null {
  const newDuration = currentTime - layer.startTime;
  if (newDuration < minDuration) {
    return null;
  }
  const nextOut = layer.inPoint + newDuration;
  if (Math.abs(layer.outPoint - nextOut) < 0.001) {
    return null;
  }
  return { outPoint: nextOut };
}

export function moveLayerInStack(
  layers: TimelineLayer[],
  layerId: string,
  direction: "up" | "down" | "top" | "bottom"
): TimelineLayer[] | null {
  const sorted = [...layers].sort((a, b) => a.index - b.index);
  const currentIndex = sorted.findIndex((layer) => layer.id === layerId);
  if (currentIndex < 0) {
    return null;
  }

  const next = [...sorted];
  const [item] = next.splice(currentIndex, 1);

  let insertAt = currentIndex;
  switch (direction) {
    case "up":
      insertAt = Math.max(0, currentIndex - 1);
      break;
    case "down":
      insertAt = Math.min(next.length, currentIndex + 1);
      break;
    case "top":
      insertAt = 0;
      break;
    case "bottom":
      insertAt = next.length;
      break;
  }

  if (direction === "up" || direction === "down") {
    if (insertAt === currentIndex) {
      return null;
    }
  }

  next.splice(insertAt, 0, item);
  return reindexLayers(next);
}

export function splitLayerAtTime(
  layer: TimelineLayer,
  splitTime: number,
  compWidth: number,
  compHeight: number,
  minDuration: number
): { left: Partial<TimelineLayer>; right: TimelineLayer } | null {
  const layerEnd = layerCompEnd(layer);
  if (splitTime <= layer.startTime + 0.001 || splitTime >= layerEnd - 0.001) {
    return null;
  }

  const delta = splitTime - layer.startTime;
  if (delta < minDuration || layerDuration(layer) - delta < minDuration) {
    return null;
  }

  const rightLayer = createTimelineLayer(
    layer.sourceItemId,
    layer.sourcePath,
    `${layer.name} 2`,
    layer.outPoint - (layer.inPoint + delta),
    layer.index + 1,
    compWidth,
    compHeight,
    splitTime
  );

  rightLayer.inPoint = layer.inPoint + delta;
  rightLayer.outPoint = layer.outPoint;
  Object.assign(rightLayer, cloneLayerEditFields(layer));
  rightLayer.effects = cloneEffects(layer.effects ?? []);
  rightLayer.enabled = layer.enabled;
  rightLayer.locked = layer.locked;
  rightLayer.muted = layer.muted;
  rightLayer.collapsed = layer.collapsed;

  return {
    left: { outPoint: layer.inPoint + delta },
    right: rightLayer,
  };
}

export function splitLayerAtPlayhead(
  layer: TimelineLayer,
  currentTime: number,
  compWidth: number,
  compHeight: number,
  minDuration: number
): { left: Partial<TimelineLayer>; right: TimelineLayer } | null {
  return splitLayerAtTime(layer, currentTime, compWidth, compHeight, minDuration);
}
