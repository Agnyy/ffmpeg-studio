import type { TimelineLayer } from "../shared/project";
import {
  TRANSFORM_GROUP_PROPERTIES,
  type TransformGroupKey,
  type TransformPropertyKey,
} from "./keyframeTypes";
import { hasAnimatedKeyframes } from "../ffmpeg/keyframeExpressions";
import { analyzeCompositionEffectRenderCompat } from "./effectKeyframeRenderCompat";

export type PropertyRenderMode = "supported" | "preview-only" | "static";

/** Render engine capabilities for Transform keyframes (v2). */
export const TRANSFORM_RENDER_ENGINE: Record<TransformGroupKey, PropertyRenderMode> = {
  position: "supported",
  scale: "supported",
  rotation: "supported",
  opacity: "supported",
};

export type TransformGroupRenderCompat = {
  group: TransformGroupKey;
  label: string;
  mode: PropertyRenderMode;
  animated: boolean;
  tooltip: string;
};

export type LayerRenderCompatEntry = {
  layerId: string;
  layerName: string;
  group: TransformGroupKey;
  label: string;
  mode: PropertyRenderMode;
};

export type CompositionRenderCompatReport = {
  groups: TransformGroupRenderCompat[];
  limitedEntries: LayerRenderCompatEntry[];
  summaryLines: string[];
  allSupported: boolean;
  hasAnimatedTransform: boolean;
  hasAnimatedEffects: boolean;
};

const GROUP_LABELS: Record<TransformGroupKey, string> = {
  position: "Position X/Y",
  scale: "Scale X/Y",
  rotation: "Rotation",
  opacity: "Opacity",
};

function isGroupAnimated(layer: TimelineLayer, group: TransformGroupKey): boolean {
  return TRANSFORM_GROUP_PROPERTIES[group].some((key) =>
    hasAnimatedKeyframes(layer.keyframes[key])
  );
}


export function getTransformGroupRenderCompat(
  layer: TimelineLayer,
  group: TransformGroupKey
): TransformGroupRenderCompat {
  const animated = isGroupAnimated(layer, group);
  const engineMode = TRANSFORM_RENDER_ENGINE[group];
  const mode: PropertyRenderMode = animated ? engineMode : "static";

  let tooltip = "Static value in preview and render.";
  if (animated && mode === "supported") {
    tooltip = "Animated in preview and render.";
  } else if (animated && mode === "preview-only") {
    tooltip =
      `${GROUP_LABELS[group]} is preview-only in current renderer. Render uses value at render range start.`;
  }

  return {
    group,
    label: GROUP_LABELS[group],
    mode,
    animated,
    tooltip,
  };
}

export function analyzeLayerRenderCompat(layer: TimelineLayer): LayerRenderCompatEntry[] {
  const entries: LayerRenderCompatEntry[] = [];
  const groups: TransformGroupKey[] = ["position", "scale", "rotation", "opacity"];

  for (const group of groups) {
    const compat = getTransformGroupRenderCompat(layer, group);
    if (compat.animated && compat.mode === "preview-only") {
      entries.push({
        layerId: layer.id,
        layerName: layer.name,
        group,
        label: compat.label,
        mode: compat.mode,
      });
    }
  }
  return entries;
}

export function analyzeCompositionRenderCompat(
  layers: TimelineLayer[]
): CompositionRenderCompatReport {
  const groups: TransformGroupKey[] = ["position", "scale", "rotation", "opacity"];
  const groupAnimated = new Map<TransformGroupKey, boolean>();

  for (const group of groups) {
    groupAnimated.set(
      group,
      layers.some((layer) => layer.enabled && isGroupAnimated(layer, group))
    );
  }

  const compatGroups: TransformGroupRenderCompat[] = groups.map((group) => {
    const animated = groupAnimated.get(group) ?? false;
    const engineMode = TRANSFORM_RENDER_ENGINE[group];
    const mode: PropertyRenderMode = animated ? engineMode : "static";
    let tooltip = "No animation on composition layers.";
    if (animated && mode === "supported") {
      tooltip = "Render supported for all layers with this animation.";
    } else if (animated && mode === "preview-only") {
      tooltip = "Preview-only — render uses value at render range start.";
    }
    return {
      group,
      label: GROUP_LABELS[group],
      mode,
      animated,
      tooltip,
    };
  });

  const limitedEntries = layers.flatMap((layer) =>
    layer.enabled ? analyzeLayerRenderCompat(layer) : []
  );

  const effectReport = analyzeCompositionEffectRenderCompat(layers);
  const summaryLines = [
    ...formatRenderCompatSummary(compatGroups, limitedEntries),
    ...effectReport.summaryLines,
  ];
  const hasAnimatedTransform = compatGroups.some((g) => g.animated);
  const allSupported =
    (hasAnimatedTransform
      ? compatGroups.every((g) => !g.animated || g.mode === "supported")
      : true) &&
    (effectReport.hasAnimatedEffects
      ? effectReport.params.every((p) => p.mode === "supported")
      : true);

  return {
    groups: compatGroups,
    limitedEntries,
    summaryLines,
    allSupported,
    hasAnimatedTransform,
    hasAnimatedEffects: effectReport.hasAnimatedEffects,
  };
}

export function formatRenderCompatSummary(
  groups: TransformGroupRenderCompat[],
  limitedEntries: LayerRenderCompatEntry[]
): string[] {
  const lines: string[] = ["Animated properties:"];
  const animatedGroups = groups.filter((g) => g.animated);

  if (animatedGroups.length === 0) {
    lines.push("No animated transform properties in composition.");
    return lines;
  }

  for (const group of animatedGroups) {
    const icon = group.mode === "supported" ? "✓" : "⚠";
    let suffix =
      group.mode === "supported"
        ? "render supported"
        : "preview only, render uses value at range start";
    if (group.mode === "supported") {
      suffix += ", easing supported";
    }
    lines.push(`${icon} ${group.label} — ${suffix}`);
  }

  if (limitedEntries.length > 0) {
    lines.push(
      `⚠ ${limitedEntries.length} animated propert${limitedEntries.length === 1 ? "y" : "ies"} have limited render support:`
    );
    for (const entry of limitedEntries) {
      lines.push(`- ${entry.label} on layer ${entry.layerName}`);
    }
  } else if (animatedGroups.every((g) => g.mode === "supported")) {
    lines.push("All animated transform properties are supported in render.");
  }

  return lines;
}

export function getPreviewOnlyWarning(
  layer: TimelineLayer,
  group: TransformGroupKey
): string | null {
  const compat = getTransformGroupRenderCompat(layer, group);
  if (compat.animated && compat.mode === "preview-only") {
    return `${compat.label} is preview-only. Render will use value at render range start.`;
  }
  return null;
}

export function isPropertyAnimated(
  layer: TimelineLayer,
  property: TransformPropertyKey
): boolean {
  return hasAnimatedKeyframes(layer.keyframes[property]);
}
