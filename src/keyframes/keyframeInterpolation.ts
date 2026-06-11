import type { KeyframeInterpolation } from "./keyframeTypes";

export const INTERPOLATION_LABELS: Record<KeyframeInterpolation, string> = {
  linear: "Linear",
  hold: "Hold",
  easeIn: "Ease In",
  easeOut: "Ease Out",
  easeInOut: "Easy Ease",
};

export const ALL_INTERPOLATIONS: KeyframeInterpolation[] = [
  "linear",
  "hold",
  "easeIn",
  "easeOut",
  "easeInOut",
];

/** Normalized 0–1 easing factor for preview interpolation. */
export function applyEasing(t: number, interpolation: KeyframeInterpolation): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (interpolation) {
    case "linear":
      return clamped;
    case "hold":
      return 0;
    case "easeIn":
      return clamped * clamped;
    case "easeOut":
      return 1 - Math.pow(1 - clamped, 2);
    case "easeInOut":
      return clamped < 0.5
        ? 2 * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
  }
}

export function isEasedInterpolation(interpolation: KeyframeInterpolation): boolean {
  return interpolation === "easeIn" || interpolation === "easeOut" || interpolation === "easeInOut";
}
