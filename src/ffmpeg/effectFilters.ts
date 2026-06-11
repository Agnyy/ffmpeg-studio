import type { LayerEffect } from "../shared/effects";
import { isCatalogEffectId } from "../shared/effects";
import type { AnimatedProperty } from "../keyframes/keyframeTypes";
import { getEffectParamDefinition } from "../keyframes/effectKeyframes";
import { getEffectiveEffectParam } from "../keyframes/layerEffectKeyframes";
import {
  buildCatalogAudioEffectFilter,
  buildCatalogVideoEffectFilter,
  getCatalogEffectRenderWarnings,
} from "./catalogEffectFilters";
import {
  buildAnimatedNumberExpression,
  hasAnimatedKeyframes,
} from "./keyframeExpressions";

function num(effect: LayerEffect, key: string, fallback: number): number {
  const value = effect.params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatNum(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function quoteExpr(expr: string): string {
  return `'${expr.replace(/'/g, "\\'")}'`;
}

function isParamAnimated(property: AnimatedProperty<number> | undefined): boolean {
  return Boolean(property && hasAnimatedKeyframes(property));
}

export type AnimatedEffectFilterContext = {
  renderStart: number;
  timeVariable: string;
};

function resolveParamValue(
  effect: LayerEffect,
  param: string,
  fallback: number,
  ctx: AnimatedEffectFilterContext | null
): string {
  const property = effect.keyframes?.[param];
  if (!property || !ctx || !hasAnimatedKeyframes(property)) {
    return formatNum(num(effect, param, fallback));
  }

  const def = getEffectParamDefinition(effect.type, param);
  if (!def?.renderSupported) {
    return formatNum(getEffectiveEffectParam(effect, param, ctx.renderStart));
  }

  return buildAnimatedNumberExpression({
    keyframes: property,
    fallbackValue: num(effect, param, fallback),
    renderStart: ctx.renderStart,
    timeVariable: ctx.timeVariable,
  });
}

export function buildVideoEffectFilters(
  effects: LayerEffect[],
  ctx: AnimatedEffectFilterContext | null = null
): string[] {
  const parts: string[] = [];

  for (const effect of effects) {
    if (!effect.enabled) {
      continue;
    }

    switch (effect.type) {
      case "brightnessContrast": {
        const brightness = resolveParamValue(effect, "brightness", 0, ctx);
        const contrast = resolveParamValue(effect, "contrast", 1, ctx);
        const evalFlag =
          ctx &&
          (isParamAnimated(effect.keyframes?.brightness) ||
            isParamAnimated(effect.keyframes?.contrast))
            ? ":eval=frame"
            : "";
        parts.push(`eq=brightness=${quoteExpr(brightness)}:contrast=${quoteExpr(contrast)}${evalFlag}`);
        break;
      }
      case "saturation": {
        const saturation = resolveParamValue(effect, "saturation", 1, ctx);
        const evalFlag = ctx && isParamAnimated(effect.keyframes?.saturation) ? ":eval=frame" : "";
        parts.push(`eq=saturation=${quoteExpr(saturation)}${evalFlag}`);
        break;
      }
      case "grayscale":
        parts.push("hue=s=0");
        break;
      case "blur": {
        const radiusExpr = resolveParamValue(effect, "radius", 2, ctx);
        const animated = ctx && isParamAnimated(effect.keyframes?.radius);
        if (animated) {
          parts.push(`boxblur=luma_radius=${quoteExpr(radiusExpr)}:eval=frame`);
        } else {
          const radius = Math.max(0, Math.min(20, num(effect, "radius", 2)));
          const r = radius.toFixed(2);
          parts.push(`boxblur=${r}:${r}`);
        }
        break;
      }
      case "sharpen": {
        const amount = ctx && isParamAnimated(effect.keyframes?.amount)
          ? getEffectiveEffectParam(effect, "amount", ctx.renderStart)
          : Math.max(0, Math.min(3, num(effect, "amount", 1)));
        parts.push(`unsharp=5:5:${amount.toFixed(4)}:5:5:0`);
        break;
      }
      case "speed": {
        const speed = ctx && isParamAnimated(effect.keyframes?.speed)
          ? getEffectiveEffectParam(effect, "speed", ctx.renderStart)
          : Math.max(0.25, Math.min(4, num(effect, "speed", 1)));
        parts.push(`setpts=PTS/${speed.toFixed(4)}`);
        break;
      }
      default: {
        if (isCatalogEffectId(effect.type)) {
          const catalogFilter = buildCatalogVideoEffectFilter(effect);
          if (catalogFilter) {
            parts.push(catalogFilter);
          }
        }
        break;
      }
    }
  }

  return parts;
}

export function buildAudioEffectFilters(
  effects: LayerEffect[],
  ctx: AnimatedEffectFilterContext | null = null
): string[] {
  const parts: string[] = [];

  for (const effect of effects) {
    if (!effect.enabled) {
      continue;
    }

    if (effect.type === "audioVolume") {
      const volumeExpr = resolveParamValue(effect, "volume", 1, ctx);
      const animated = ctx && isParamAnimated(effect.keyframes?.volume);
      if (animated) {
        parts.push(`volume=${quoteExpr(volumeExpr)}:eval=frame`);
      } else {
        const volume = Math.max(0, Math.min(2, num(effect, "volume", 1)));
        parts.push(`volume=${volume.toFixed(4)}`);
      }
    }

    if (effect.type === "speed") {
      const speed = ctx && isParamAnimated(effect.keyframes?.speed)
        ? getEffectiveEffectParam(effect, "speed", ctx.renderStart)
        : Math.max(0.5, Math.min(2, num(effect, "speed", 1)));
      parts.push(`atempo=${speed.toFixed(4)}`);
    }

    if (isCatalogEffectId(effect.type)) {
      const catalogFilter = buildCatalogAudioEffectFilter(effect);
      if (catalogFilter) {
        parts.push(catalogFilter);
      }
    }
  }

  return parts;
}

export function getEffectRenderWarnings(effects: LayerEffect[]): string[] {
  const warnings: string[] = [];

  for (const effect of effects) {
    if (!effect.enabled) {
      continue;
    }

    if (effect.type === "speed") {
      const speed = num(effect, "speed", 1);
      if (speed < 0.5 || speed > 2) {
        warnings.push(
          "Warning: Speed is limited to 0.5–2 in render for reliable atempo. Preview may differ."
        );
      }
      if (isParamAnimated(effect.keyframes?.speed)) {
        warnings.push(
          "Warning: Animated Speed is not fully supported in render. Using value at range start."
        );
      }
    }

    if (effect.type === "sharpen" && isParamAnimated(effect.keyframes?.amount)) {
      warnings.push(
        "Warning: Animated Sharpen is preview/render limited in current renderer."
      );
    }

    if (effect.type === "blur" && isParamAnimated(effect.keyframes?.radius)) {
      const def = getEffectParamDefinition("blur", "radius");
      if (!def?.renderSupported) {
        warnings.push("Warning: Animated Blur radius may use value at render range start.");
      }
    }

    if (isCatalogEffectId(effect.type)) {
      warnings.push(...getCatalogEffectRenderWarnings(effect));
    }
  }

  return warnings;
}
