import type { KeyframeInterpolation, TransformPropertyKey } from "./keyframeTypes";
import type { LayerEffectType } from "../shared/effects";

export type SelectedKeyframeRef =
  | {
      kind: "transform";
      layerId: string;
      property: TransformPropertyKey;
      keyframeId: string;
    }
  | {
      kind: "effect";
      layerId: string;
      effectId: string;
      param: string;
      keyframeId: string;
    };

export type KeyframeClipboard =
  | {
      kind: "transform";
      property: TransformPropertyKey;
      keyframes: Array<{
        relativeTime: number;
        value: number;
        interpolation: KeyframeInterpolation;
      }>;
    }
  | {
      kind: "effect";
      effectType: LayerEffectType;
      param: string;
      keyframes: Array<{
        relativeTime: number;
        value: number;
        interpolation: KeyframeInterpolation;
      }>;
    };

export function keyframeRefKey(ref: SelectedKeyframeRef): string {
  if (ref.kind === "transform") {
    return `${ref.layerId}:transform:${ref.property}:${ref.keyframeId}`;
  }
  return `${ref.layerId}:effect:${ref.effectId}:${ref.param}:${ref.keyframeId}`;
}

export function isKeyframeSelected(
  refs: SelectedKeyframeRef[],
  layerId: string,
  target:
    | { kind: "transform"; property: TransformPropertyKey; keyframeId: string }
    | { kind: "effect"; effectId: string; param: string; keyframeId: string }
): boolean {
  return refs.some((ref) => {
    if (ref.layerId !== layerId || ref.keyframeId !== target.keyframeId) {
      return false;
    }
    if (target.kind === "transform") {
      return ref.kind === "transform" && ref.property === target.property;
    }
    return ref.kind === "effect" && ref.effectId === target.effectId && ref.param === target.param;
  });
}

export function refsMatch(ref: SelectedKeyframeRef, other: SelectedKeyframeRef): boolean {
  return keyframeRefKey(ref) === keyframeRefKey(other);
}
