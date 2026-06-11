import type { LayerTransform } from "../shared/transform";
import type { TimelineLayer } from "../shared/project";
import type { LayerKeyframes, TransformGroupKey, TransformPropertyKey } from "./keyframeTypes";
import { TRANSFORM_GROUP_PROPERTIES } from "./keyframeTypes";
import { collectAllLayerKeyframeTimes } from "./layerEffectKeyframes";
import {
  addOrUpdateKeyframe,
  findKeyframeAtTime,
  getAnimatedValue,
  removeKeyframeAtTime,
} from "./keyframeUtils";

export function getEffectiveLayerTransform(
  layer: TimelineLayer,
  compTime: number
): LayerTransform {
  const base = layer.transform;
  const kf = layer.keyframes;

  return {
    positionX: getAnimatedValue(kf.positionX, base.positionX, compTime),
    positionY: getAnimatedValue(kf.positionY, base.positionY, compTime),
    scaleX: getAnimatedValue(kf.scaleX, base.scaleX, compTime),
    scaleY: getAnimatedValue(kf.scaleY, base.scaleY, compTime),
    rotation: getAnimatedValue(kf.rotation, base.rotation, compTime),
    opacity: getAnimatedValue(kf.opacity, base.opacity, compTime),
    anchorX: base.anchorX,
    anchorY: base.anchorY,
  };
}

export function isTransformGroupAnimated(
  keyframes: LayerKeyframes,
  group: TransformGroupKey
): boolean {
  return TRANSFORM_GROUP_PROPERTIES[group].some(
    (key) => keyframes[key].enabled && keyframes[key].keyframes.length > 0
  );
}

export function isTransformGroupEnabled(
  keyframes: LayerKeyframes,
  group: TransformGroupKey
): boolean {
  return TRANSFORM_GROUP_PROPERTIES[group].every((key) => keyframes[key].enabled);
}

export function hasKeyframeAtTime(
  keyframes: LayerKeyframes,
  group: TransformGroupKey,
  time: number,
  tolerance = 0.05
): boolean {
  return TRANSFORM_GROUP_PROPERTIES[group].some((key) =>
    Boolean(findKeyframeAtTime(keyframes[key], time, tolerance))
  );
}

export function toggleTransformGroupAnimation(
  keyframes: LayerKeyframes,
  group: TransformGroupKey,
  layer: TimelineLayer,
  compTime: number
): LayerKeyframes {
  const enabled = isTransformGroupEnabled(keyframes, group);
  const effective = getEffectiveLayerTransform(layer, compTime);
  let next = { ...keyframes };

  if (enabled) {
    for (const key of TRANSFORM_GROUP_PROPERTIES[group]) {
      next = { ...next, [key]: { ...next[key], enabled: false } };
    }
    return next;
  }

  for (const key of TRANSFORM_GROUP_PROPERTIES[group]) {
    const value = effective[key as TransformPropertyKey] as number;
    next = {
      ...next,
      [key]: addOrUpdateKeyframe({ ...next[key], enabled: true }, compTime, value),
    };
  }
  return next;
}

export function toggleKeyframeDiamondAtTime(
  keyframes: LayerKeyframes,
  group: TransformGroupKey,
  layer: TimelineLayer,
  compTime: number
): LayerKeyframes {
  const effective = getEffectiveLayerTransform(layer, compTime);
  let next = { ...keyframes };

  const hasDiamond = hasKeyframeAtTime(keyframes, group, compTime);

  for (const key of TRANSFORM_GROUP_PROPERTIES[group]) {
    if (hasDiamond) {
      next = {
        ...next,
        [key]: removeKeyframeAtTime(next[key], compTime),
      };
    } else {
      const value = effective[key as TransformPropertyKey] as number;
      next = {
        ...next,
        [key]: addOrUpdateKeyframe(
          { ...next[key], enabled: true },
          compTime,
          value
        ),
      };
    }
  }

  return next;
}

export function applyTransformPatchWithKeyframes(
  layer: TimelineLayer,
  patch: Partial<LayerTransform>,
  compTime: number,
  uniformScale: boolean
): { transform: LayerTransform; keyframes: LayerKeyframes } {
  let nextTransform = { ...layer.transform, ...patch };
  let nextKeyframes = layer.keyframes;

  if (uniformScale && patch.scaleX !== undefined && patch.scaleY === undefined) {
    nextTransform.scaleY = patch.scaleX;
  }
  if (uniformScale && patch.scaleY !== undefined && patch.scaleX === undefined) {
    nextTransform.scaleX = patch.scaleY;
  }

  const propertyMap: Array<{
    key: TransformPropertyKey;
    value: number | undefined;
  }> = [
    { key: "positionX", value: patch.positionX },
    { key: "positionY", value: patch.positionY },
    { key: "scaleX", value: patch.scaleX ?? (uniformScale ? patch.scaleY : undefined) },
    { key: "scaleY", value: patch.scaleY ?? (uniformScale ? patch.scaleX : undefined) },
    { key: "rotation", value: patch.rotation },
    { key: "opacity", value: patch.opacity },
  ];

  for (const { key, value } of propertyMap) {
    if (value === undefined) {
      continue;
    }
    if (nextKeyframes[key].enabled) {
      nextKeyframes = {
        ...nextKeyframes,
        [key]: addOrUpdateKeyframe(nextKeyframes[key], compTime, value),
      };
    } else {
      nextTransform = { ...nextTransform, [key]: value };
    }
  }

  return { transform: nextTransform, keyframes: nextKeyframes };
}

export function collectLayerKeyframeTimes(layer: TimelineLayer): number[] {
  return collectAllLayerKeyframeTimes(layer);
}

export function findAdjacentKeyframeTime(
  layer: TimelineLayer,
  currentTime: number,
  direction: -1 | 1
): number | null {
  const times = collectAllLayerKeyframeTimes(layer);
  if (times.length === 0) {
    return null;
  }

  if (direction < 0) {
    let candidate: number | null = null;
    for (const time of times) {
      if (time < currentTime - 0.0005) {
        candidate = time;
      }
    }
    return candidate;
  }

  for (const time of times) {
    if (time > currentTime + 0.0005) {
      return time;
    }
  }
  return null;
}

