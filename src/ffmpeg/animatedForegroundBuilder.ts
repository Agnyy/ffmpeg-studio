import type { EditClipOptions } from "../shared/clipEdit";
import type { LayerEffect } from "../shared/effects";
import type { TimelineLayer } from "../shared/project";
import {
  buildAnimatedNumberExpression,
  hasAnimatedKeyframes,
} from "./keyframeExpressions";
import { buildVideoEffectFilters } from "./effectFilters";

function formatSeconds(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function quoteExpr(expr: string): string {
  return `'${expr.replace(/'/g, "\\'")}'`;
}

export type AnimatedForegroundContext = {
  layer: TimelineLayer;
  options: EditClipOptions;
  effects: LayerEffect[];
  renderStart: number;
  overlayStart: number;
};

/**
 * Foreground filter chain with per-frame expressions for animated transform.
 * Input stream `t` is local trim time; composition-relative time = overlayStart + t.
 */
export function buildAnimatedForegroundFilters(ctx: AnimatedForegroundContext): string {
  const { layer, options, effects, renderStart, overlayStart } = ctx;
  const tf = layer.transform;
  const kf = layer.keyframes;
  const fgTime = `(${formatSeconds(overlayStart)}+t)`;

  const parts: string[] = [];

  if (options.cropEnabled && options.crop) {
    const { width, height, x, y } = options.crop;
    parts.push(
      `crop=${Math.max(2, Math.round(width))}:${Math.max(2, Math.round(height))}:${Math.max(0, Math.round(x))}:${Math.max(0, Math.round(y))}`
    );
  }

  const scaleXAnimated = hasAnimatedKeyframes(kf.scaleX);
  const scaleYAnimated = hasAnimatedKeyframes(kf.scaleY);
  const uniform = layer.uniformScale;

  if (scaleXAnimated || scaleYAnimated) {
    const scaleXExpr = scaleXAnimated
      ? buildAnimatedNumberExpression({
          keyframes: kf.scaleX,
          fallbackValue: tf.scaleX,
          renderStart,
          timeVariable: fgTime,
        })
      : formatNum(tf.scaleX);
    const scaleYExpr =
      uniform || !scaleYAnimated
        ? scaleXExpr
        : buildAnimatedNumberExpression({
            keyframes: kf.scaleY,
            fallbackValue: tf.scaleY,
            renderStart,
            timeVariable: fgTime,
          });
    parts.push(
      `scale=w=${quoteExpr(`iw*(${scaleXExpr}/100)`)}:h=${quoteExpr(`ih*(${scaleYExpr}/100)`)}:eval=frame`
    );
  } else {
    parts.push(
      `scale=iw*${(tf.scaleX / 100).toFixed(4)}:ih*${(tf.scaleY / 100).toFixed(4)}`
    );
  }

  if (hasAnimatedKeyframes(kf.rotation)) {
    const rotExpr = buildAnimatedNumberExpression({
      keyframes: kf.rotation,
      fallbackValue: tf.rotation,
      renderStart,
      timeVariable: fgTime,
    });
    parts.push(`rotate=angle=${quoteExpr(`${rotExpr}*PI/180`)}:c=black@0:eval=frame`);
  } else if (Math.abs(tf.rotation) > 0.01) {
    parts.push(`rotate=${tf.rotation}*PI/180:c=black@0`);
  }

  parts.push(
    ...buildVideoEffectFilters(effects, {
      renderStart,
      timeVariable: fgTime,
    })
  );

  if (hasAnimatedKeyframes(kf.opacity)) {
    const opExpr = buildAnimatedNumberExpression({
      keyframes: kf.opacity,
      fallbackValue: tf.opacity,
      renderStart,
      timeVariable: fgTime,
    });
    parts.push(`format=rgba,colorchannelmixer=aa=${quoteExpr(`${opExpr}/100`)}:eval=frame`);
  } else if (tf.opacity < 99.99) {
    parts.push(`format=rgba,colorchannelmixer=aa=${(tf.opacity / 100).toFixed(4)}`);
  }

  return parts.join(",");
}

function formatNum(value: number): string {
  return Number(value.toFixed(4)).toString();
}
