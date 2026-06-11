import type { AnimatedProperty, Keyframe, KeyframeInterpolation } from "../keyframes/keyframeTypes";
import { sortKeyframes } from "../keyframes/keyframeUtils";

function formatNum(value: number): string {
  return Number(value.toFixed(4)).toString();
}

export type AnimatedNumberExpressionInput = {
  keyframes: AnimatedProperty<number>;
  fallbackValue: number;
  renderStart: number;
  timeVariable?: string;
};

function buildSegmentExpression(
  current: Keyframe<number>,
  next: Keyframe<number>,
  t0: number,
  t1: number,
  timeVariable: string
): string {
  const v0 = formatNum(current.value);
  const delta = formatNum(next.value - current.value);
  const span = t1 - t0;
  const dt = `(${timeVariable}-${formatNum(t0)})`;
  const u = `(${dt})/${formatNum(span)}`;

  const interpolation: KeyframeInterpolation = current.interpolation ?? "linear";

  switch (interpolation) {
    case "hold":
      return v0;
    case "linear":
      return `${v0}+${formatNum((next.value - current.value) / span)}*${dt}`;
    case "easeIn":
      return `${v0}+${delta}*pow(${u},2)`;
    case "easeOut":
      return `${v0}+${delta}*(1-pow(1-${u},2))`;
    case "easeInOut": {
      const eased = `if(lt(${u},0.5),2*pow(${u},2),1-pow(-2*${u}+2,2)/2)`;
      return `${v0}+${delta}*(${eased})`;
    }
  }
}

/**
 * Builds a piecewise FFmpeg expression with linear/hold/easing segments.
 * Compares (compositionTime - renderStart) against sorted keyframes.
 * `timeVariable` defaults to `t` (output timeline seconds from render start).
 */
export function buildAnimatedNumberExpression(input: AnimatedNumberExpressionInput): string {
  const { keyframes, fallbackValue, renderStart, timeVariable = "t" } = input;
  const time = timeVariable;

  if (!keyframes.enabled || keyframes.keyframes.length === 0) {
    return formatNum(fallbackValue);
  }

  const sorted = sortKeyframes(keyframes.keyframes);
  if (sorted.length === 1) {
    return formatNum(sorted[0].value);
  }

  const parts: string[] = [];
  const first = sorted[0];
  const firstLocal = first.time - renderStart;
  parts.push(`if(lt(${time},${formatNum(firstLocal)}),${formatNum(first.value)}`);

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const t0 = current.time - renderStart;
    const t1 = next.time - renderStart;
    const span = t1 - t0;

    if (span <= 0) {
      parts.push(`if(lt(${time},${formatNum(t1)}),${formatNum(next.value)}`);
      continue;
    }

    const expr = buildSegmentExpression(current, next, t0, t1, time);
    parts.push(`if(lt(${time},${formatNum(t1)}),${expr}`);
  }

  const last = sorted[sorted.length - 1];
  parts.push(formatNum(last.value));
  parts.push(")".repeat(parts.length - 1));

  return parts.join(",");
}

/** @deprecated Use buildAnimatedNumberExpression */
export function buildLinearExpressionForKeyframes(
  property: AnimatedProperty<number>,
  fallbackValue: number,
  renderStart: number
): string {
  return buildAnimatedNumberExpression({
    keyframes: property,
    fallbackValue,
    renderStart,
    timeVariable: "t",
  });
}

export function hasAnimatedKeyframes(property: AnimatedProperty<number>): boolean {
  return property.enabled && property.keyframes.length > 1;
}

export function propertyUsesEasing(property: AnimatedProperty<number>): boolean {
  return property.keyframes.some(
    (kf) =>
      kf.interpolation === "easeIn" ||
      kf.interpolation === "easeOut" ||
      kf.interpolation === "easeInOut"
  );
}
