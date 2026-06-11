import type { LayerEffect } from "../shared/effects";
import type { TimelineLayer } from "../shared/project";
import { hasAnimatedKeyframes } from "../ffmpeg/keyframeExpressions";
import {
  EFFECT_KEYFRAME_PARAMS,
  getEffectParamDefinition,
  getEffectParamDefinitions,
} from "./effectKeyframes";
import type { PropertyRenderMode } from "./keyframeRenderCompat";

export type EffectParamRenderCompat = {
  effectType: LayerEffect["type"];
  param: string;
  label: string;
  mode: PropertyRenderMode;
  animated: boolean;
  tooltip: string;
};

export type EffectRenderCompatEntry = {
  layerId: string;
  layerName: string;
  effectName: string;
  param: string;
  label: string;
  mode: PropertyRenderMode;
};

function getParamRenderMode(
  effectType: LayerEffect["type"],
  param: string,
  animated: boolean
): PropertyRenderMode {
  if (!animated) {
    return "static";
  }
  const def = getEffectParamDefinition(effectType, param);
  if (!def) {
    return "static";
  }
  if (def.renderSupported && def.previewSupported) {
    return "supported";
  }
  if (def.renderSupported && !def.previewSupported) {
    return "supported";
  }
  return "preview-only";
}

export function getEffectParamRenderCompat(
  effect: LayerEffect,
  param: string
): EffectParamRenderCompat {
  const def = getEffectParamDefinition(effect.type, param);
  const label = def?.label ?? param;
  const property = effect.keyframes?.[param];
  const animated = Boolean(property && hasAnimatedKeyframes(property));
  const mode = getParamRenderMode(effect.type, param, animated);

  let tooltip = "Static value in preview and render.";
  if (animated && mode === "supported") {
    tooltip = def?.previewSupported
      ? "Animated in preview and render."
      : "Animated in render (no CSS preview).";
  } else if (animated && mode === "preview-only") {
    if (effect.type === "speed" && param === "speed") {
      tooltip =
        "Animated Speed is not fully supported in render. Using value at range start.";
    } else if (effect.type === "sharpen" && param === "amount") {
      tooltip = "Animated Sharpen is preview/render limited in current renderer.";
    } else if (effect.type === "blur" && param === "radius") {
      tooltip = "Animated Blur radius may use value at render range start.";
    } else {
      tooltip = "Preview-only — render uses value at render range start.";
    }
  }

  return {
    effectType: effect.type,
    param,
    label,
    mode,
    animated,
    tooltip,
  };
}

export function analyzeLayerEffectRenderCompat(layer: TimelineLayer): EffectRenderCompatEntry[] {
  const entries: EffectRenderCompatEntry[] = [];
  for (const effect of layer.effects ?? []) {
    if (!effect.enabled) {
      continue;
    }
    for (const def of getEffectParamDefinitions(effect.type)) {
      const compat = getEffectParamRenderCompat(effect, def.param);
      if (compat.animated && compat.mode === "preview-only") {
        entries.push({
          layerId: layer.id,
          layerName: layer.name,
          effectName: effect.name,
          param: def.param,
          label: `${effect.name} ${compat.label}`,
          mode: compat.mode,
        });
      }
    }
  }
  return entries;
}

export function analyzeCompositionEffectRenderCompat(
  layers: TimelineLayer[]
): {
  params: EffectParamRenderCompat[];
  limitedEntries: EffectRenderCompatEntry[];
  summaryLines: string[];
  hasAnimatedEffects: boolean;
} {
  const animatedParams = new Map<string, EffectParamRenderCompat>();

  for (const layer of layers) {
    if (!layer.enabled) {
      continue;
    }
    for (const effect of layer.effects ?? []) {
      if (!effect.enabled) {
        continue;
      }
      for (const def of getEffectParamDefinitions(effect.type)) {
        const compat = getEffectParamRenderCompat(effect, def.param);
        if (!compat.animated) {
          continue;
        }
        const key = `${effect.type}:${def.param}`;
        if (!animatedParams.has(key)) {
          animatedParams.set(key, compat);
        }
      }
    }
  }

  const params = [...animatedParams.values()];
  const limitedEntries = layers.flatMap((layer) =>
    layer.enabled ? analyzeLayerEffectRenderCompat(layer) : []
  );

  const summaryLines = formatEffectRenderCompatSummary(params, limitedEntries);

  return {
    params,
    limitedEntries,
    summaryLines,
    hasAnimatedEffects: params.length > 0,
  };
}

export function formatEffectRenderCompatSummary(
  params: EffectParamRenderCompat[],
  limitedEntries: EffectRenderCompatEntry[]
): string[] {
  if (params.length === 0) {
    return [];
  }

  const lines: string[] = ["Animated effect parameters:"];

  for (const param of params) {
    const icon = param.mode === "supported" ? "✓" : "⚠";
    let suffix =
      param.mode === "supported"
        ? "preview/render supported"
        : "render may use value at range start";
    if (param.effectType === "speed" && param.param === "speed") {
      suffix = "animated render not supported";
    }
    if (param.effectType === "sharpen" && param.param === "amount") {
      suffix = "preview/render limited";
    }
    lines.push(`${icon} ${param.label} — ${suffix}`);
  }

  if (limitedEntries.length > 0) {
    for (const entry of limitedEntries) {
      lines.push(`⚠ ${entry.label} on layer ${entry.layerName}`);
    }
  }

  return lines;
}

export function getAnimatedEffectParamKeys(): string[] {
  return EFFECT_KEYFRAME_PARAMS.map((def) => `${def.effectType}.${def.param}`);
}
