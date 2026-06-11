import { Diamond, Timer } from "lucide-react";
import type { LayerEffect } from "../../shared/effects";
import type { EffectKeyframeParamDefinition } from "../../keyframes/effectKeyframes";
import {
  getEffectParamRenderCompat,
} from "../../keyframes/effectKeyframeRenderCompat";
import {
  getEffectiveEffectParam,
  hasEffectKeyframeAtTime,
  isEffectParamAnimationEnabled,
} from "../../keyframes/layerEffectKeyframes";
import type { SelectedKeyframeRef } from "../../keyframes/keyframeSelection";

type EffectParamKeyframeControlsProps = {
  effect: LayerEffect;
  definition: EffectKeyframeParamDefinition;
  compCurrentTime: number;
  layerId: string;
  selectedKeyframes: SelectedKeyframeRef[];
  children: React.ReactNode;
  onToggleAnimation: (effectId: string, param: string) => void;
  onToggleDiamond: (effectId: string, param: string) => void;
};

function hasSelectedInParam(
  layerId: string,
  effectId: string,
  param: string,
  selectedKeyframes: SelectedKeyframeRef[]
): boolean {
  return selectedKeyframes.some(
    (ref) =>
      ref.kind === "effect" &&
      ref.layerId === layerId &&
      ref.effectId === effectId &&
      ref.param === param
  );
}

export default function EffectParamKeyframeControls({
  effect,
  definition,
  compCurrentTime,
  layerId,
  selectedKeyframes,
  children,
  onToggleAnimation,
  onToggleDiamond,
}: EffectParamKeyframeControlsProps) {
  const enabled = isEffectParamAnimationEnabled(effect, definition.param);
  const hasDiamond = hasEffectKeyframeAtTime(effect, definition.param, compCurrentTime);
  const keyCount = effect.keyframes?.[definition.param]?.keyframes.length ?? 0;
  const hasSelection = hasSelectedInParam(layerId, effect.id, definition.param, selectedKeyframes);
  const renderCompat = getEffectParamRenderCompat(effect, definition.param);

  const statusClass =
    renderCompat.mode === "supported"
      ? "supported"
      : renderCompat.mode === "preview-only"
        ? "preview-only"
        : "static";

  return (
    <div className={`transform-kf-group effect-param-kf-group ${hasSelection ? "has-keyframe-selection" : ""}`}>
      <div className="transform-kf-header">
        <button
          type="button"
          className={`transform-kf-stopwatch ${enabled ? "active" : ""}`}
          onClick={() => onToggleAnimation(effect.id, definition.param)}
          title={enabled ? "Disable animation" : "Enable animation (stopwatch)"}
          aria-pressed={enabled}
        >
          <Timer size={14} />
        </button>
        <span className="transform-kf-label">{definition.label}</span>
        <span className="transform-kf-key-count">
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
                ? "Render only"
                : ""}
          </span>
        )}
        <button
          type="button"
          className={`transform-kf-diamond ${hasDiamond ? "active" : ""}`}
          onClick={() => onToggleDiamond(effect.id, definition.param)}
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

export function getEffectiveEffectParamValue(
  effect: LayerEffect,
  param: string,
  compTime: number,
  defaultValue: number
): number {
  return getEffectiveEffectParam(effect, param, compTime) ?? defaultValue;
}
