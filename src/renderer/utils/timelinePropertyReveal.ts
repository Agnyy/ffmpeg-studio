import type { LayerEffect } from "../../shared/effects";
import { getEffectParamDefinitions } from "../../keyframes/effectKeyframes";
import {
  isEffectParamAnimationEnabled,
  hasEffectKeyframeAtTime,
} from "../../keyframes/layerEffectKeyframes";
import { hasAnimatedKeyframes } from "../../ffmpeg/keyframeExpressions";
import type { TransformGroupKey } from "../../keyframes/keyframeTypes";
import { isTransformGroupEnabled } from "../../keyframes/layerTransformKeyframes";
import type { TimelineLayer } from "../../shared/project";
import { createDefaultTransform } from "../../shared/transform";
import type { PropertyRow } from "../components/TimelinePropertySidebarRow";
import type { EditorTool } from "../../tools/toolTypes";

export type RevealedProperty =
  | "position"
  | "scale"
  | "rotation"
  | "opacity"
  | "anchor"
  | "effects"
  | "crop";

export type TimelineRevealMode = "normal" | "property-reveal" | "changed-only";

export type TimelineRevealState = {
  mode: TimelineRevealMode;
  layerId?: string;
  properties: RevealedProperty[];
};

export const NORMAL_TIMELINE_REVEAL: TimelineRevealState = {
  mode: "normal",
  properties: [],
};

function isTransformGroupChanged(
  layer: TimelineLayer,
  group: TransformGroupKey,
  compWidth: number,
  compHeight: number
): boolean {
  if (isTransformGroupEnabled(layer.keyframes, group)) {
    return true;
  }
  const defaults = createDefaultTransform(compWidth, compHeight);
  const transform = layer.transform;
  switch (group) {
    case "position":
      return (
        transform.positionX !== defaults.positionX ||
        transform.positionY !== defaults.positionY
      );
    case "scale":
      return transform.scaleX !== defaults.scaleX || transform.scaleY !== defaults.scaleY;
    case "rotation":
      return transform.rotation !== defaults.rotation;
    case "opacity":
      return transform.opacity !== defaults.opacity;
  }
}

function isAnchorChanged(layer: TimelineLayer, compWidth: number, compHeight: number): boolean {
  const defaults = createDefaultTransform(compWidth, compHeight);
  return (
    layer.transform.anchorX !== defaults.anchorX || layer.transform.anchorY !== defaults.anchorY
  );
}

function isEffectParamChanged(effect: LayerEffect, param: string): boolean {
  if (isEffectParamAnimationEnabled(effect, param)) {
    return true;
  }
  const def = getEffectParamDefinitions(effect.type).find((entry) => entry.param === param);
  if (!def) {
    return false;
  }
  const value = effect.params[param];
  if (typeof value !== "number") {
    return false;
  }
  return Math.abs(value - def.defaultValue) > 0.0001;
}

function isAudioLevelsChanged(layer: TimelineLayer): boolean {
  const volumeEffect = (layer.effects ?? []).find(
    (effect) => effect.enabled && effect.type === "audioVolume"
  );
  if (!volumeEffect) {
    return false;
  }
  return isEffectParamChanged(volumeEffect, "volume");
}

export function isPropertyRowChanged(
  layer: TimelineLayer,
  row: PropertyRow,
  compWidth: number,
  compHeight: number
): boolean {
  switch (row.kind) {
    case "crop":
    case "crop-field":
      return Boolean(layer.cropEnabled);
    case "transform":
      return (
        isTransformGroupChanged(layer, "position", compWidth, compHeight) ||
        isTransformGroupChanged(layer, "scale", compWidth, compHeight) ||
        isTransformGroupChanged(layer, "rotation", compWidth, compHeight) ||
        isTransformGroupChanged(layer, "opacity", compWidth, compHeight) ||
        isAnchorChanged(layer, compWidth, compHeight)
      );
    case "keyframe-position":
      return isTransformGroupChanged(layer, "position", compWidth, compHeight);
    case "keyframe-scale":
      return isTransformGroupChanged(layer, "scale", compWidth, compHeight);
    case "keyframe-rotation":
      return isTransformGroupChanged(layer, "rotation", compWidth, compHeight);
    case "keyframe-opacity":
      return isTransformGroupChanged(layer, "opacity", compWidth, compHeight);
    case "anchor":
      return isAnchorChanged(layer, compWidth, compHeight);
    case "audio-levels":
      return isAudioLevelsChanged(layer);
    case "effects":
      return (layer.effects ?? []).some((effect) =>
        getEffectParamDefinitions(effect.type).some((def) =>
          isEffectParamChanged(effect, def.param)
        )
      );
    case "effect": {
      const effect = (layer.effects ?? []).find((entry) => entry.id === row.effectId);
      if (!effect) {
        return false;
      }
      return getEffectParamDefinitions(effect.type).some((def) =>
        isEffectParamChanged(effect, def.param)
      );
    }
    case "effect-param": {
      const effect = (layer.effects ?? []).find((entry) => entry.id === row.effectId);
      return effect ? isEffectParamChanged(effect, row.param) : false;
    }
    default:
      return false;
  }
}

function propertyToRow(property: RevealedProperty): PropertyRow | null {
  switch (property) {
    case "position":
      return { kind: "keyframe-position" };
    case "scale":
      return { kind: "keyframe-scale" };
    case "rotation":
      return { kind: "keyframe-rotation" };
    case "opacity":
      return { kind: "keyframe-opacity" };
    case "anchor":
      return { kind: "anchor" };
    case "crop":
      return { kind: "crop" };
    case "effects":
      return { kind: "effects" };
  }
}

const TRANSFORM_CHILD_ROWS: PropertyRow[] = [
  { kind: "anchor" },
  { kind: "keyframe-position" },
  { kind: "keyframe-scale" },
  { kind: "keyframe-rotation" },
  { kind: "keyframe-opacity" },
];

const CROP_CHILD_ROWS: PropertyRow[] = [
  { kind: "crop-field", field: "x", label: "X" },
  { kind: "crop-field", field: "y", label: "Y" },
  { kind: "crop-field", field: "width", label: "Width" },
  { kind: "crop-field", field: "height", label: "Height" },
];

function buildEffectRows(layer: TimelineLayer): PropertyRow[] {
  const rows: PropertyRow[] = [];
  for (const effect of layer.effects ?? []) {
    rows.push({ kind: "effect", effectId: effect.id, label: effect.name });
    if (!effect.collapsed) {
      for (const def of getEffectParamDefinitions(effect.type)) {
        rows.push({
          kind: "effect-param",
          effectId: effect.id,
          param: def.param,
          label: def.label,
        });
      }
    }
  }
  return rows;
}

function buildChangedOnlyRows(
  layer: TimelineLayer,
  compWidth: number,
  compHeight: number
): PropertyRow[] {
  const rows: PropertyRow[] = [];
  for (const child of TRANSFORM_CHILD_ROWS) {
    if (isPropertyRowChanged(layer, child, compWidth, compHeight)) {
      rows.push(child);
    }
  }
  if (isPropertyRowChanged(layer, { kind: "audio-levels" }, compWidth, compHeight)) {
    rows.push({ kind: "audio-levels" });
  }
  if (layer.cropEnabled) {
    for (const cropRow of [{ kind: "crop" as const }, ...CROP_CHILD_ROWS]) {
      if (isPropertyRowChanged(layer, cropRow, compWidth, compHeight)) {
        rows.push(cropRow);
      }
    }
  }
  for (const effectRow of buildEffectRows(layer)) {
    if (isPropertyRowChanged(layer, effectRow, compWidth, compHeight)) {
      rows.push(effectRow);
    }
  }
  return rows;
}

function buildPropertyRevealRows(
  layer: TimelineLayer,
  properties: RevealedProperty[]
): PropertyRow[] {
  const rows: PropertyRow[] = [];
  for (const property of properties) {
    if (property === "effects") {
      if ((layer.effects ?? []).length > 0) {
        rows.push({ kind: "effects" }, ...buildEffectRows(layer));
      }
      continue;
    }
    if (property === "crop") {
      rows.push({ kind: "crop" }, ...CROP_CHILD_ROWS);
      continue;
    }
    const row = propertyToRow(property);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

function shouldShowCrop(layer: TimelineLayer): boolean {
  return layer.cropEnabled;
}

export function propertyRowMatchesHighlight(
  row: PropertyRow,
  highlight: RevealedProperty
): boolean {
  const target = propertyToRow(highlight);
  if (!target) {
    return false;
  }
  if (target.kind !== row.kind) {
    return false;
  }
  if (target.kind === "effect" && row.kind === "effect") {
    return target.effectId === row.effectId;
  }
  if (target.kind === "effect-param" && row.kind === "effect-param") {
    return target.effectId === row.effectId && target.param === row.param;
  }
  return true;
}

export function isLayerInRevealMode(
  reveal: TimelineRevealState,
  layerId: string
): boolean {
  if (reveal.mode === "normal") {
    return false;
  }
  return reveal.layerId === layerId;
}

export function getPropertyRows(
  layer: TimelineLayer,
  options?: {
    reveal?: TimelineRevealState | null;
    compWidth?: number;
    compHeight?: number;
    selectedLayerId?: string | null;
    activeTool?: EditorTool;
  }
): PropertyRow[] {
  if (layer.collapsed) {
    return [];
  }

  const compWidth = options?.compWidth ?? 1920;
  const compHeight = options?.compHeight ?? 1080;
  const reveal = options?.reveal ?? NORMAL_TIMELINE_REVEAL;
  const targetLayerId = reveal.layerId ?? options?.selectedLayerId ?? null;
  const isTargetLayer = targetLayerId === layer.id;

  if (reveal.mode === "property-reveal") {
    if (!isTargetLayer) {
      return [];
    }
    if (reveal.properties.length === 0) {
      return [];
    }
    return buildPropertyRevealRows(layer, reveal.properties);
  }

  if (reveal.mode === "changed-only") {
    if (!isTargetLayer) {
      return [];
    }
    return buildChangedOnlyRows(layer, compWidth, compHeight);
  }

  const rows: PropertyRow[] = [];
  rows.push({ kind: "transform" });
  if (layer.transformExpanded) {
    rows.push(...TRANSFORM_CHILD_ROWS);
  }

  if (layer.hasAudio) {
    rows.push({ kind: "audio" });
    if (layer.audioExpanded) {
      rows.push({ kind: "audio-levels" });
      rows.push({ kind: "waveform" });
    }
  }

  const effects = layer.effects ?? [];
  if (effects.length > 0) {
    rows.push({ kind: "effects" });
    rows.push(...buildEffectRows(layer));
  }

  if (shouldShowCrop(layer)) {
    rows.push({ kind: "crop" });
    if (layer.cropExpanded) {
      rows.push(...CROP_CHILD_ROWS);
    }
  }

  return rows;
}

export function layerHasAnimatedKeyframes(layer: TimelineLayer): boolean {
  const keys = Object.keys(layer.keyframes) as Array<keyof typeof layer.keyframes>;
  if (keys.some((key) => hasAnimatedKeyframes(layer.keyframes[key]))) {
    return true;
  }
  for (const effect of layer.effects ?? []) {
    for (const def of getEffectParamDefinitions(effect.type)) {
      if (isEffectParamAnimationEnabled(effect, def.param)) {
        return true;
      }
      if (hasEffectKeyframeAtTime(effect, def.param, 0)) {
        return true;
      }
    }
  }
  return false;
}

export function revealPropertyToRowKind(property: RevealedProperty): PropertyRow["kind"] | null {
  const row = propertyToRow(property);
  return row?.kind ?? null;
}
