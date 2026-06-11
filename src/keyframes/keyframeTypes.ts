export type KeyframeInterpolation =
  | "linear"
  | "hold"
  | "easeIn"
  | "easeOut"
  | "easeInOut";

export type Keyframe<T = number> = {
  id: string;
  time: number;
  value: T;
  interpolation: KeyframeInterpolation;
};

export type AnimatedProperty<T = number> = {
  enabled: boolean;
  keyframes: Keyframe<T>[];
};

export type LayerKeyframes = {
  positionX: AnimatedProperty<number>;
  positionY: AnimatedProperty<number>;
  scaleX: AnimatedProperty<number>;
  scaleY: AnimatedProperty<number>;
  rotation: AnimatedProperty<number>;
  opacity: AnimatedProperty<number>;
};

export type TransformPropertyKey = keyof LayerKeyframes;

export type TransformGroupKey = "position" | "scale" | "rotation" | "opacity";

export const TRANSFORM_GROUP_PROPERTIES: Record<TransformGroupKey, TransformPropertyKey[]> = {
  position: ["positionX", "positionY"],
  scale: ["scaleX", "scaleY"],
  rotation: ["rotation"],
  opacity: ["opacity"],
};

export function createDefaultLayerKeyframes(): LayerKeyframes {
  const empty: AnimatedProperty<number> = { enabled: false, keyframes: [] };
  return {
    positionX: { ...empty, keyframes: [] },
    positionY: { ...empty, keyframes: [] },
    scaleX: { ...empty, keyframes: [] },
    scaleY: { ...empty, keyframes: [] },
    rotation: { ...empty, keyframes: [] },
    opacity: { ...empty, keyframes: [] },
  };
}
