import type { LayerEffect, LayerEffectParamValue } from "../shared/effects";
import type { TimelineLayer } from "../shared/project";
import {
  createDefaultEffectParamKeyframes,
  getEffectParamDefinition,
  getEffectParamDefinitions,
  type EffectParamKeyframes,
} from "./effectKeyframes";
import {
  addOrUpdateKeyframe,
  cloneKeyframesProperty,
  findKeyframeAtTime,
  getAnimatedValue,
  removeKeyframeAtTime,
  sortKeyframes,
} from "./keyframeUtils";

function numParam(effect: LayerEffect, param: string, fallback: number): number {
  const value = effect.params[param];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function ensureEffectKeyframes(effect: LayerEffect): LayerEffect {
  const keyframes = effect.keyframes ?? createDefaultEffectParamKeyframes(effect.type);
  return {
    ...effect,
    keyframes: Object.fromEntries(
      getEffectParamDefinitions(effect.type).map((def) => [
        def.param,
        effect.keyframes?.[def.param] ?? keyframes[def.param],
      ])
    ) as EffectParamKeyframes,
  };
}

export function getEffectiveEffectParam(
  effect: LayerEffect,
  param: string,
  compTime: number
): number {
  const def = getEffectParamDefinition(effect.type, param);
  const fallback = def
    ? numParam(effect, param, def.defaultValue)
    : numParam(effect, param, 0);
  const property = effect.keyframes?.[param];
  if (!property) {
    return fallback;
  }
  return getAnimatedValue(property, fallback, compTime);
}

export function getEffectiveEffectParams(
  effect: LayerEffect,
  compTime: number
): Record<string, number> {
  const params: Record<string, number> = {};
  for (const def of getEffectParamDefinitions(effect.type)) {
    params[def.param] = getEffectiveEffectParam(effect, def.param, compTime);
  }
  return params;
}

export function getEffectiveEffects(
  layer: TimelineLayer,
  compTime: number
): LayerEffect[] {
  return (layer.effects ?? []).map((effect) => {
    const effectiveParams = getEffectiveEffectParams(effect, compTime);
    return {
      ...effect,
      params: {
        ...effect.params,
        ...effectiveParams,
      },
    };
  });
}

export function isEffectParamAnimationEnabled(
  effect: LayerEffect,
  param: string
): boolean {
  return Boolean(effect.keyframes?.[param]?.enabled);
}

export function hasEffectKeyframeAtTime(
  effect: LayerEffect,
  param: string,
  time: number,
  tolerance = 0.05
): boolean {
  const property = effect.keyframes?.[param];
  if (!property) {
    return false;
  }
  return Boolean(findKeyframeAtTime(property, time, tolerance));
}

export function toggleEffectParamAnimation(
  effect: LayerEffect,
  param: string,
  compTime: number
): LayerEffect {
  const def = getEffectParamDefinition(effect.type, param);
  if (!def) {
    return effect;
  }
  const ensured = ensureEffectKeyframes(effect);
  const property = ensured.keyframes![param];
  const value = getEffectiveEffectParam(ensured, param, compTime);

  if (property.enabled) {
    return {
      ...ensured,
      keyframes: {
        ...ensured.keyframes!,
        [param]: { ...property, enabled: false },
      },
    };
  }

  return {
    ...ensured,
    keyframes: {
      ...ensured.keyframes!,
      [param]: addOrUpdateKeyframe({ ...property, enabled: true }, compTime, value),
    },
  };
}

export function toggleEffectParamDiamondAtTime(
  effect: LayerEffect,
  param: string,
  compTime: number
): LayerEffect {
  const def = getEffectParamDefinition(effect.type, param);
  if (!def) {
    return effect;
  }
  const ensured = ensureEffectKeyframes(effect);
  const property = ensured.keyframes![param];
  const value = getEffectiveEffectParam(ensured, param, compTime);
  const hasDiamond = hasEffectKeyframeAtTime(ensured, param, compTime);

  return {
    ...ensured,
    keyframes: {
      ...ensured.keyframes!,
      [param]: hasDiamond
        ? removeKeyframeAtTime(property, compTime)
        : addOrUpdateKeyframe({ ...property, enabled: true }, compTime, value),
    },
  };
}

export function applyLayerEffectParamPatch(
  effect: LayerEffect,
  param: string,
  value: LayerEffectParamValue,
  compTime: number
): LayerEffect {
  if (typeof value === "number") {
    return applyEffectParamPatchWithKeyframes(effect, param, value, compTime);
  }
  return {
    ...effect,
    params: { ...effect.params, [param]: value },
  };
}

export function applyEffectParamPatchWithKeyframes(
  effect: LayerEffect,
  param: string,
  value: number,
  compTime: number
): LayerEffect {
  const def = getEffectParamDefinition(effect.type, param);
  if (!def) {
    return effect;
  }
  const clamped = Math.max(def.min, Math.min(def.max, value));
  const ensured = ensureEffectKeyframes(effect);
  const property = ensured.keyframes![param];

  if (property.enabled) {
    return {
      ...ensured,
      keyframes: {
        ...ensured.keyframes!,
        [param]: addOrUpdateKeyframe(property, compTime, clamped),
      },
    };
  }

  return {
    ...ensured,
    params: { ...ensured.params, [param]: clamped },
  };
}

export function collectEffectKeyframeTimes(layer: TimelineLayer): number[] {
  const times = new Set<number>();
  for (const effect of layer.effects ?? []) {
    if (!effect.enabled) {
      continue;
    }
    for (const def of getEffectParamDefinitions(effect.type)) {
      const property = effect.keyframes?.[def.param];
      if (!property?.enabled) {
        continue;
      }
      for (const kf of property.keyframes) {
        times.add(kf.time);
      }
    }
  }
  return sortKeyframes(
    [...times].map((time) => ({
      id: String(time),
      time,
      value: time,
      interpolation: "linear" as const,
    }))
  ).map((kf) => kf.time);
}

export function collectAllLayerKeyframeTimes(layer: TimelineLayer): number[] {
  const times = new Set<number>();
  for (const property of Object.values(layer.keyframes)) {
    if (!property.enabled) {
      continue;
    }
    for (const kf of property.keyframes) {
      times.add(kf.time);
    }
  }
  for (const t of collectEffectKeyframeTimes(layer)) {
    times.add(t);
  }
  return sortKeyframes(
    [...times].map((time) => ({
      id: String(time),
      time,
      value: time,
      interpolation: "linear" as const,
    }))
  ).map((kf) => kf.time);
}

export function findAdjacentLayerKeyframeTime(
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

export function cloneEffectParamKeyframes(effect: LayerEffect): EffectParamKeyframes {
  const source = effect.keyframes ?? createDefaultEffectParamKeyframes(effect.type);
  const next: EffectParamKeyframes = {};
  for (const def of getEffectParamDefinitions(effect.type)) {
    next[def.param] = cloneKeyframesProperty(source[def.param]);
  }
  return next;
}
