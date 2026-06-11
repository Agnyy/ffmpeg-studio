import type { KeyframeInterpolation } from "../../keyframes/keyframeTypes";
import {
  isKeyframeSelected,
  type SelectedKeyframeRef,
} from "../../keyframes/keyframeSelection";

export function resolveTransformGroupInterpolation(
  markers: Array<{ id: string; property: string; interpolation?: KeyframeInterpolation }>,
  layerId: string,
  selectedKeyframes: SelectedKeyframeRef[]
): KeyframeInterpolation {
  const selectedMarker = markers.find((marker) =>
    isKeyframeSelected(selectedKeyframes, layerId, {
      kind: "transform",
      property: marker.property as import("../../keyframes/keyframeTypes").TransformPropertyKey,
      keyframeId: marker.id,
    })
  );
  if (selectedMarker) {
    return selectedMarker.interpolation ?? "linear";
  }

  const unique = [...new Set(markers.map((marker) => marker.interpolation ?? "linear"))];
  if (unique.length === 1) {
    return unique[0];
  }

  return markers[0]?.interpolation ?? "linear";
}
