import { Diamond, Timer } from "lucide-react";
import type { LayerTransform } from "../../shared/transform";
import type { TimelineLayer } from "../../shared/project";
import {
  getEffectiveLayerTransform,
  hasKeyframeAtTime,
  isTransformGroupEnabled,
} from "../../keyframes/layerTransformKeyframes";
import { getTransformGroupRenderCompat } from "../../keyframes/keyframeRenderCompat";
import type { TransformGroupKey } from "../../keyframes/keyframeTypes";
import { TRANSFORM_GROUP_PROPERTIES } from "../../keyframes/keyframeTypes";
import type { SelectedKeyframeRef } from "../../keyframes/keyframeSelection";

type TransformKeyframeControlsProps = {
  group: TransformGroupKey;
  label: string;
  selectedLayer: TimelineLayer;
  compCurrentTime: number;
  selectedKeyframes: SelectedKeyframeRef[];
  children: React.ReactNode;
  onToggleAnimation: (group: TransformGroupKey) => void;
  onToggleDiamond: (group: TransformGroupKey) => void;
};

function countGroupKeyframes(layer: TimelineLayer, group: TransformGroupKey): number {
  return TRANSFORM_GROUP_PROPERTIES[group].reduce(
    (sum, key) => sum + layer.keyframes[key].keyframes.length,
    0
  );
}

function hasSelectedInGroup(
  layer: TimelineLayer,
  group: TransformGroupKey,
  selectedKeyframes: SelectedKeyframeRef[]
): boolean {
  const keys = new Set(TRANSFORM_GROUP_PROPERTIES[group]);
  return selectedKeyframes.some(
    (ref) => ref.kind === "transform" && ref.layerId === layer.id && keys.has(ref.property)
  );
}

export default function TransformKeyframeControls({
  group,
  label,
  selectedLayer,
  compCurrentTime,
  selectedKeyframes,
  children,
  onToggleAnimation,
  onToggleDiamond,
}: TransformKeyframeControlsProps) {
  const enabled = isTransformGroupEnabled(selectedLayer.keyframes, group);
  const hasDiamond = hasKeyframeAtTime(selectedLayer.keyframes, group, compCurrentTime);
  const renderCompat = getTransformGroupRenderCompat(selectedLayer, group);
  const keyCount = countGroupKeyframes(selectedLayer, group);
  const hasSelection = hasSelectedInGroup(selectedLayer, group, selectedKeyframes);
  const rowHighlighted =
    hasSelection ||
    selectedKeyframes.some(
      (ref) =>
        ref.kind === "transform" &&
        ref.layerId === selectedLayer.id &&
        TRANSFORM_GROUP_PROPERTIES[group].includes(ref.property)
    );

  const statusClass =
    renderCompat.mode === "supported"
      ? "supported"
      : renderCompat.mode === "preview-only"
        ? "preview-only"
        : "static";

  return (
    <div className={`transform-kf-group ${rowHighlighted ? "has-keyframe-selection" : ""}`}>
      <div className="transform-kf-header">
        <button
          type="button"
          className={`transform-kf-stopwatch ${enabled ? "active" : ""}`}
          onClick={() => onToggleAnimation(group)}
          title={enabled ? "Disable animation" : "Enable animation (stopwatch)"}
          aria-pressed={enabled}
        >
          <Timer size={14} />
        </button>
        <span className="transform-kf-label">{label}</span>
        <span className="transform-kf-key-count" title={`${keyCount} keyframe${keyCount === 1 ? "" : "s"}`}>
          {keyCount} {keyCount === 1 ? "key" : "keys"}
        </span>
        {renderCompat.animated && (
          <span
            className={`transform-kf-render-status ${statusClass}`}
            title={renderCompat.tooltip}
          >
            {renderCompat.mode === "supported"
              ? "Render"
              : renderCompat.mode === "preview-only"
                ? "Preview only"
                : ""}
          </span>
        )}
        <button
          type="button"
          className={`transform-kf-diamond ${hasDiamond ? "active" : ""}`}
          onClick={() => onToggleDiamond(group)}
          title={hasDiamond ? "Remove keyframe at playhead" : "Add keyframe at playhead"}
          aria-pressed={hasDiamond}
        >
          <Diamond size={12} />
        </button>
      </div>
      <div className="transform-kf-fields">{children}</div>
    </div>
  );
}

export function useEffectiveTransform(layer: TimelineLayer, compCurrentTime: number): LayerTransform {
  return getEffectiveLayerTransform(layer, compCurrentTime);
}
