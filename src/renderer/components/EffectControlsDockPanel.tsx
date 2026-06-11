import type { LayerEffect } from "../../shared/effects";
import { isEffectPreviewable } from "../../shared/effects";
import { getCatalogEffectById } from "../../effects/ffmpegEffectCatalog";
import { useFfmpegFilters } from "../hooks/useFfmpegFilters";
import type { TimelineLayer } from "../../shared/project";
import type { SelectedKeyframeRef } from "../../keyframes/keyframeSelection";
import { EffectParamsEditor } from "./EffectControlsPanel";

type EffectControlsDockPanelProps = {
  selectedLayer: TimelineLayer | null;
  compCurrentTime: number;
  selectedKeyframes: SelectedKeyframeRef[];
  onToggleEffectParamAnimation: (effectId: string, param: string) => void;
  onToggleEffectParamDiamond: (effectId: string, param: string) => void;
  onEffectParamChange: (
    effectId: string,
    param: string,
    value: import("../../shared/effects").LayerEffectParamValue
  ) => void;
  onEffectsChange: (effects: LayerEffect[]) => void;
  onVidstabAnalyze?: (layerId: string, effect: LayerEffect) => void;
  analysisBusyEffectId?: string | null;
};

function moveEffect(effects: LayerEffect[], effectId: string, direction: -1 | 1): LayerEffect[] {
  const index = effects.findIndex((entry) => entry.id === effectId);
  if (index < 0) {
    return effects;
  }
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= effects.length) {
    return effects;
  }
  const next = [...effects];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export default function EffectControlsDockPanel({
  selectedLayer,
  compCurrentTime,
  selectedKeyframes,
  onToggleEffectParamAnimation,
  onToggleEffectParamDiamond,
  onEffectParamChange,
  onEffectsChange,
  onVidstabAnalyze,
  analysisBusyEffectId = null,
}: EffectControlsDockPanelProps) {
  const { isEffectAvailable } = useFfmpegFilters();

  if (!selectedLayer) {
    return (
      <div className="effect-controls-empty">
        <strong>No layer selected</strong>
        <p>Select a layer in the timeline to edit its effects.</p>
      </div>
    );
  }

  const effects = selectedLayer.effects ?? [];

  const patchEffect = (effectId: string, patch: Partial<LayerEffect>) => {
    onEffectsChange(
      effects.map((entry) => (entry.id === effectId ? { ...entry, ...patch } : entry))
    );
  };

  return (
    <div className="effect-controls-dock">
      <div className="effect-controls-dock-head">
        <h3 className="effect-controls-dock-title">Effect Controls</h3>
        <p className="effect-controls-dock-layer">{selectedLayer.name}</p>
      </div>

      <section className="effect-controls-section" data-effect-section="effects">
        <h4 className="effect-controls-section-title">Effects</h4>

        {effects.length === 0 && (
          <p className="effect-controls-hint">
            No effects applied.
            <br />
            Add effects from Effects &amp; Presets.
          </p>
        )}

        {effects.map((effect, index) => (
          <div
            key={effect.id}
            className={`effect-item ${effect.enabled ? "" : "effect-item-disabled"}`}
            data-effect-id={effect.id}
          >
            <div className="effect-item-header">
              <label className="effect-item-enabled">
                <input
                  type="checkbox"
                  checked={effect.enabled}
                  onChange={(e) => patchEffect(effect.id, { enabled: e.target.checked })}
                />
              </label>
              <button
                type="button"
                className="effect-item-collapse"
                onClick={() => patchEffect(effect.id, { collapsed: !effect.collapsed })}
              >
                {effect.collapsed ? "▶" : "▼"}
              </button>
              <span className="effect-item-name">{effect.name}</span>
              {!isEffectPreviewable(effect.type) && (
                <span className="effect-render-only">Render only</span>
              )}
              <div className="effect-item-actions">
                <button
                  type="button"
                  className="effect-item-action"
                  disabled={index === 0}
                  onClick={() => onEffectsChange(moveEffect(effects, effect.id, -1))}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="effect-item-action"
                  disabled={index === effects.length - 1}
                  onClick={() => onEffectsChange(moveEffect(effects, effect.id, 1))}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="effect-item-action effect-item-delete"
                  onClick={() =>
                    onEffectsChange(effects.filter((entry) => entry.id !== effect.id))
                  }
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>
            {!effect.collapsed && (
              <div className="effect-item-body">
                <EffectParamsEditor
                  effect={effect}
                  layerId={selectedLayer.id}
                  compCurrentTime={compCurrentTime}
                  selectedKeyframes={selectedKeyframes}
                  onToggleEffectParamAnimation={onToggleEffectParamAnimation}
                  onToggleEffectParamDiamond={onToggleEffectParamDiamond}
                  onEffectParamChange={onEffectParamChange}
                  analysisBusy={analysisBusyEffectId === effect.id}
                  onAnalyzeVidstab={() =>
                    onVidstabAnalyze?.(selectedLayer.id, effect)
                  }
                  filtersAvailable={
                    effect.type === "vidstab"
                      ? isEffectAvailable(getCatalogEffectById("vidstab")!)
                      : true
                  }
                />
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
