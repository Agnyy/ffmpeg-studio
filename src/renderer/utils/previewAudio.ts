import type { TimelineLayer } from "../../shared/project";
import { getLayerSourceTime, isLayerVisibleAtCompTime } from "../../shared/project";
import { getEffectiveEffectParam } from "../../keyframes/layerEffectKeyframes";

export function resolveAudibleLayerId(
  layers: TimelineLayer[],
  compTime: number,
  selectedLayerId: string | null
): string | null {
  const audible = layers.filter(
    (layer) =>
      layer.enabled &&
      layer.hasVideo &&
      !layer.muted &&
      isLayerVisibleAtCompTime(layer, compTime)
  );
  if (audible.length === 0) {
    return null;
  }

  const selected = selectedLayerId
    ? audible.find((layer) => layer.id === selectedLayerId)
    : null;
  if (selected) {
    return selected.id;
  }

  return audible.reduce((top, layer) => (layer.index > top.index ? layer : top)).id;
}

export function getLayerPreviewVolume(layer: TimelineLayer, compTime: number): number {
  if (layer.muted) {
    return 0;
  }
  const volumeEffect = (layer.effects ?? []).find(
    (effect) => effect.enabled && effect.type === "audioVolume"
  );
  if (!volumeEffect) {
    return 1;
  }
  return Math.max(0, Math.min(1, getEffectiveEffectParam(volumeEffect, "volume", compTime)));
}

export function clampSourceTimeToVideoDuration(
  sourceTime: number,
  videoDuration: number
): number {
  if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
    return sourceTime;
  }
  return Math.min(sourceTime, Math.max(0, videoDuration - 0.001));
}

export function getLayerSourceTimeAtComp(
  layer: TimelineLayer,
  compTime: number
): number | null {
  return getLayerSourceTime(layer, compTime);
}
