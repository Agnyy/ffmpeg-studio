import { useEffect, useRef, useState } from "react";
import { getBasename } from "../../shared/pathUtils";
import type { CropAspectRatio, CropRect } from "../../shared/clipEdit";
import { createDefaultCrop } from "../../shared/clipEdit";
import {
  createLayerEffect,
  EFFECT_MENU_GROUPS,
  isCatalogEffectId,
  isEffectRenderOnly,
  type LayerEffect,
  type LayerEffectParamValue,
  type LayerEffectType,
} from "../../shared/effects";
import { getCatalogEffectById } from "../../effects/ffmpegEffectCatalog";
import { useFfmpegFilters } from "../hooks/useFfmpegFilters";
import VidstabEffectControls from "./VidstabEffectControls";
import type { LayerTransform } from "../../shared/transform";
import type { TimelineLayer } from "../../shared/project";
import { layerDuration } from "../../shared/project";
import type { MediaInfo } from "../../shared/types";
import {
  centerTransform,
  fillTransform,
  fitTransform,
  getLayerSourceSize,
  resetTransform,
} from "../utils/layerTransform";
import { getEffectiveLayerTransform } from "../../keyframes/layerTransformKeyframes";
import type { TransformGroupKey } from "../../keyframes/keyframeTypes";
import type { SelectedKeyframeRef } from "../../keyframes/keyframeSelection";
import { getEffectParamDefinitions } from "../../keyframes/effectKeyframes";
import EffectParamKeyframeControls, {
  getEffectiveEffectParamValue,
} from "./EffectParamKeyframeControls";
import TransformKeyframeControls from "./TransformKeyframeControls";
import ScrubbableNumber from "./ScrubbableNumber";
import { clampTrimRange, formatTimecode, parseTimeInput } from "../utils/time";

export type EffectControlsFocus = {
  section?: "layer" | "transform" | "crop" | "timing" | "effects";
  effectId?: string;
  effectParamKey?: string;
  transformField?: "position" | "scale" | "rotation" | "opacity" | "anchor";
  revealChanged?: boolean;
  revealSections?: Array<"layer" | "transform" | "crop" | "timing" | "effects">;
};

type EffectControlsPanelProps = {
  inputPath: string | null;
  mediaInfo?: MediaInfo;
  selectedLayer: TimelineLayer | null;
  sourceDuration: number;
  compWidth: number;
  compHeight: number;
  videoWidth: number;
  videoHeight: number;
  compCurrentTime: number;
  focusRequest?: EffectControlsFocus | null;
  onToggleTransformAnimation: (group: TransformGroupKey) => void;
  onToggleKeyframeDiamond: (group: TransformGroupKey) => void;
  selectedKeyframes: SelectedKeyframeRef[];
  onToggleEffectParamAnimation: (effectId: string, param: string) => void;
  onToggleEffectParamDiamond: (effectId: string, param: string) => void;
  onEffectParamChange: (
    effectId: string,
    param: string,
    value: LayerEffectParamValue
  ) => void;
  onLayerChange: (patch: Partial<TimelineLayer>) => void;
  onTransformChange: (patch: Partial<LayerTransform>) => void;
  onCropChange: (crop: CropRect) => void;
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

export function EffectParamsEditor({
  effect,
  layerId,
  compCurrentTime,
  selectedKeyframes,
  onToggleEffectParamAnimation,
  onToggleEffectParamDiamond,
  onEffectParamChange,
  filtersAvailable = true,
  analysisBusy = false,
  onAnalyzeVidstab,
  onClearVidstab,
}: {
  effect: LayerEffect;
  layerId: string;
  compCurrentTime: number;
  selectedKeyframes: SelectedKeyframeRef[];
  onToggleEffectParamAnimation: (effectId: string, param: string) => void;
  onToggleEffectParamDiamond: (effectId: string, param: string) => void;
  onEffectParamChange: (
    effectId: string,
    param: string,
    value: LayerEffectParamValue
  ) => void;
  filtersAvailable?: boolean;
  analysisBusy?: boolean;
  onAnalyzeVidstab?: () => void;
  onClearVidstab?: () => void;
}) {
  if (effect.type === "grayscale") {
    return <p className="effect-controls-hint">Converts video to grayscale.</p>;
  }

  if (effect.type === "vidstab") {
    return (
      <VidstabEffectControls
        effect={effect}
        layerId={layerId}
        filtersAvailable={filtersAvailable ?? true}
        analysisBusy={analysisBusy ?? false}
        onEffectParamChange={onEffectParamChange}
        onAnalyzeMotion={onAnalyzeVidstab ?? (() => undefined)}
        onClearAnalysis={onClearVidstab ?? (() => undefined)}
      />
    );
  }

  const catalogDef = isCatalogEffectId(effect.type)
    ? getCatalogEffectById(effect.type)
    : undefined;
  const enumParams = catalogDef?.params.filter((param) => param.type === "enum" && !param.hidden) ?? [];

  const definitions = getEffectParamDefinitions(effect.type);

  return (
    <>
      {catalogDef && (
        <p className="effect-controls-hint">{catalogDef.description}</p>
      )}
      {enumParams.map((param) => (
        <label key={param.key} className="effect-param-row">
          <span>{param.label}</span>
          <select
            value={String(effect.params[param.key] ?? param.defaultValue)}
            onChange={(e) => onEffectParamChange(effect.id, param.key, e.target.value)}
          >
            {(param.enumOptions ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {definitions.map((definition) => {
        const value = getEffectiveEffectParamValue(
          effect,
          definition.param,
          compCurrentTime,
          definition.defaultValue
        );
        return (
          <EffectParamKeyframeControls
            key={definition.param}
            effect={effect}
            definition={definition}
            compCurrentTime={compCurrentTime}
            layerId={layerId}
            selectedKeyframes={selectedKeyframes}
            onToggleAnimation={onToggleEffectParamAnimation}
            onToggleDiamond={onToggleEffectParamDiamond}
          >
            <ScrubbableNumber
              value={value}
              formatValue={(v) => v.toFixed(definition.param === "radius" ? 1 : 2)}
              min={definition.min}
              max={definition.max}
              step={definition.param === "radius" ? 0.5 : 0.05}
              sensitivity={definition.param === "radius" ? 0.05 : 0.01}
              onChange={(next) => onEffectParamChange(effect.id, definition.param, next)}
            />
          </EffectParamKeyframeControls>
        );
      })}
    </>
  );
}

export default function EffectControlsPanel({
  inputPath,
  mediaInfo,
  selectedLayer,
  sourceDuration,
  compWidth,
  compHeight,
  videoWidth,
  videoHeight,
  compCurrentTime,
  focusRequest,
  onToggleTransformAnimation,
  onToggleKeyframeDiamond,
  selectedKeyframes,
  onToggleEffectParamAnimation,
  onToggleEffectParamDiamond,
  onEffectParamChange,
  onLayerChange,
  onTransformChange,
  onCropChange,
  onEffectsChange,
  onVidstabAnalyze,
  analysisBusyEffectId = null,
}: EffectControlsPanelProps) {
  const { isEffectAvailable } = useFfmpegFilters();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  useEffect(() => {
    if (!focusRequest || !bodyRef.current) {
      return;
    }

    if (focusRequest.revealChanged) {
      const targets = focusRequest.revealSections?.length
        ? focusRequest.revealSections.map(
            (section) => `[data-effect-section="${section}"]`
          )
        : ["[data-effect-section]"];
      for (const selector of targets) {
        const node = bodyRef.current.querySelector(selector);
        if (node instanceof HTMLElement) {
          node.scrollIntoView({ block: "nearest", behavior: "smooth" });
          node.classList.add("effect-controls-focus-flash");
          window.setTimeout(() => node.classList.remove("effect-controls-focus-flash"), 600);
        }
      }
    }

    const fieldIdMap: Record<string, string> = {
      position: "effect-transform-pos-x",
      scale: "effect-transform-scale-x",
      rotation: "effect-transform-rotation",
      opacity: "effect-transform-opacity",
      anchor: "effect-transform-anchor-x",
    };

    if (focusRequest.transformField) {
      document.getElementById(fieldIdMap[focusRequest.transformField])?.focus();
    }

    const selector = focusRequest.effectId
      ? `[data-effect-id="${focusRequest.effectId}"]`
      : focusRequest.section
        ? `[data-effect-section="${focusRequest.section}"]`
        : null;
    if (!selector) {
      return;
    }
    const node = bodyRef.current.querySelector(selector);
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ block: "nearest", behavior: "smooth" });
      node.classList.add("effect-controls-focus-flash");
      window.setTimeout(() => node.classList.remove("effect-controls-focus-flash"), 600);
    }
  }, [focusRequest]);

  if (!selectedLayer || !inputPath) {
    return (
      <div className="effect-controls-empty">
        <strong>No layer selected</strong>
        <p>Select a layer in the timeline to edit its effects.</p>
      </div>
    );
  }

  const transform = getEffectiveLayerTransform(selectedLayer, compCurrentTime);
  const effects = selectedLayer.effects ?? [];
  const layerSource = getLayerSourceSize(
    videoWidth || mediaInfo?.width || 0,
    videoHeight || mediaInfo?.height || 0,
    selectedLayer.crop,
    selectedLayer.cropEnabled
  );
  const crop = selectedLayer.crop;
  const layerDur = layerDuration(selectedLayer);

  const updateEffects = (updater: (current: LayerEffect[]) => LayerEffect[]) => {
    onEffectsChange(updater(effects));
  };

  const patchEffect = (effectId: string, patch: Partial<LayerEffect>) => {
    updateEffects((current) =>
      current.map((effect) => (effect.id === effectId ? { ...effect, ...patch } : effect))
    );
  };

  const handleAddEffect = (type: LayerEffectType) => {
    updateEffects((current) => [...current, createLayerEffect(type)]);
    setAddMenuOpen(false);
  };

  const handleVidstabClear = (effect: LayerEffect) => {
    updateEffects((current) =>
      current.map((entry) =>
        entry.id === effect.id
          ? {
              ...entry,
              params: {
                ...entry.params,
                analysisStatus: "none",
                analysisPath: "",
              },
            }
          : entry
      )
    );
  };

  const updateStartTime = (value: string) => {
    onLayerChange({ startTime: Math.max(0, parseTimeInput(value)) });
  };

  const updateInPoint = (value: string) => {
    const nextIn = parseTimeInput(value, sourceDuration);
    const next = clampTrimRange(nextIn, selectedLayer.outPoint, sourceDuration);
    onLayerChange({ inPoint: next.trimStart, outPoint: next.trimEnd });
  };

  const updateOutPoint = (value: string) => {
    const nextOut = parseTimeInput(value, sourceDuration);
    const next = clampTrimRange(selectedLayer.inPoint, nextOut, sourceDuration);
    onLayerChange({ inPoint: next.trimStart, outPoint: next.trimEnd });
  };

  const resetTiming = () => {
    const next = clampTrimRange(0, sourceDuration, sourceDuration);
    onLayerChange({ startTime: 0, inPoint: next.trimStart, outPoint: next.trimEnd });
  };

  const resetCrop = () => {
    const vw = videoWidth || mediaInfo?.width || 0;
    const vh = videoHeight || mediaInfo?.height || 0;
    if (vw && vh) {
      onCropChange(createDefaultCrop(vw, vh));
    }
  };

  const toggleCrop = (enabled: boolean) => {
    const vw = videoWidth || mediaInfo?.width || 0;
    const vh = videoHeight || mediaInfo?.height || 0;
    onLayerChange({
      cropEnabled: enabled,
      crop: enabled
        ? selectedLayer.crop ?? (vw && vh ? createDefaultCrop(vw, vh) : undefined)
        : selectedLayer.crop,
    });
  };

  return (
    <div className="effect-controls-panel">
      <div className="effect-controls-header">
        <h3 className="effect-controls-title">Effect Controls</h3>
        <p className="effect-controls-subtitle">{selectedLayer.name}</p>
      </div>

      <div ref={bodyRef} className="effect-controls-body">
        <section className="effect-controls-section" data-effect-section="layer">
          <h4 className="effect-controls-section-title">Layer</h4>
          <div className="effect-controls-row">
            <span>Name</span>
            <span>{selectedLayer.name}</span>
          </div>
          <label className="inspector-checkbox">
            <input
              type="checkbox"
              checked={selectedLayer.enabled}
              onChange={(e) => onLayerChange({ enabled: e.target.checked })}
            />
            Enabled
          </label>
          <label className="inspector-checkbox">
            <input
              type="checkbox"
              checked={selectedLayer.locked}
              onChange={(e) => onLayerChange({ locked: e.target.checked })}
            />
            Locked
          </label>
          <label className="inspector-checkbox">
            <input
              type="checkbox"
              checked={selectedLayer.muted}
              onChange={(e) => onLayerChange({ muted: e.target.checked })}
            />
            Muted
          </label>
          <div className="effect-controls-row">
            <span>File</span>
            <span>{getBasename(inputPath)}</span>
          </div>
        </section>

        <section className="effect-controls-section" data-effect-section="transform">
          <h4 className="effect-controls-section-title">Transform</h4>

          <TransformKeyframeControls
            group="position"
            label="Position"
            selectedLayer={selectedLayer}
            compCurrentTime={compCurrentTime}
            selectedKeyframes={selectedKeyframes}
            onToggleAnimation={onToggleTransformAnimation}
            onToggleDiamond={onToggleKeyframeDiamond}
          >
            <div className="inspector-field-row">
              <input
                id="effect-transform-pos-x"
                type="number"
                step={1}
                value={Math.round(transform.positionX)}
                onChange={(e) =>
                  onTransformChange({ positionX: parseFloat(e.target.value) || 0 })
                }
              />
              <input
                type="number"
                step={1}
                value={Math.round(transform.positionY)}
                onChange={(e) =>
                  onTransformChange({ positionY: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </TransformKeyframeControls>

          <TransformKeyframeControls
            group="scale"
            label="Scale"
            selectedLayer={selectedLayer}
            compCurrentTime={compCurrentTime}
            selectedKeyframes={selectedKeyframes}
            onToggleAnimation={onToggleTransformAnimation}
            onToggleDiamond={onToggleKeyframeDiamond}
          >
            <div className="inspector-field-row">
              <input
                id="effect-transform-scale-x"
                type="number"
                step={0.1}
                value={Number(transform.scaleX.toFixed(1))}
                onChange={(e) => {
                  const next = parseFloat(e.target.value) || 100;
                  onTransformChange(
                    selectedLayer.uniformScale ? { scaleX: next, scaleY: next } : { scaleX: next }
                  );
                }}
              />
              <input
                type="number"
                step={0.1}
                value={Number(transform.scaleY.toFixed(1))}
                disabled={selectedLayer.uniformScale}
                onChange={(e) =>
                  onTransformChange({ scaleY: parseFloat(e.target.value) || 100 })
                }
              />
            </div>
            <label className="inspector-checkbox">
              <input
                type="checkbox"
                checked={selectedLayer.uniformScale}
                onChange={(e) => onLayerChange({ uniformScale: e.target.checked })}
              />
              Uniform scale
            </label>
          </TransformKeyframeControls>

          <TransformKeyframeControls
            group="rotation"
            label="Rotation"
            selectedLayer={selectedLayer}
            compCurrentTime={compCurrentTime}
            selectedKeyframes={selectedKeyframes}
            onToggleAnimation={onToggleTransformAnimation}
            onToggleDiamond={onToggleKeyframeDiamond}
          >
            <input
              id="effect-transform-rotation"
              type="number"
              step={0.1}
              value={Number(transform.rotation.toFixed(1))}
              onChange={(e) =>
                onTransformChange({ rotation: parseFloat(e.target.value) || 0 })
              }
            />
          </TransformKeyframeControls>

          <TransformKeyframeControls
            group="opacity"
            label="Opacity"
            selectedLayer={selectedLayer}
            compCurrentTime={compCurrentTime}
            selectedKeyframes={selectedKeyframes}
            onToggleAnimation={onToggleTransformAnimation}
            onToggleDiamond={onToggleKeyframeDiamond}
          >
            <input
              id="effect-transform-opacity"
              type="number"
              min={0}
              max={100}
              value={Math.round(transform.opacity)}
              onChange={(e) =>
                onTransformChange({
                  opacity: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)),
                })
              }
            />
          </TransformKeyframeControls>
          <div className="inspector-field-row">
            <label>Anchor</label>
            <input
              id="effect-transform-anchor-x"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={Number(transform.anchorX.toFixed(2))}
              onChange={(e) =>
                onTransformChange({ anchorX: parseFloat(e.target.value) || 0 })
              }
            />
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={Number(transform.anchorY.toFixed(2))}
              onChange={(e) =>
                onTransformChange({ anchorY: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
          <div className="inspector-transform-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                onTransformChange(centerTransform(compWidth, compHeight, transform))
              }
            >
              Center
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                onTransformChange(
                  fitTransform(
                    compWidth,
                    compHeight,
                    layerSource.width,
                    layerSource.height,
                    transform
                  )
                )
              }
            >
              Fit
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                onTransformChange(
                  fillTransform(
                    compWidth,
                    compHeight,
                    layerSource.width,
                    layerSource.height,
                    transform
                  )
                )
              }
            >
              Fill
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onTransformChange(resetTransform(compWidth, compHeight))}
            >
              Reset
            </button>
          </div>
        </section>

        <section className="effect-controls-section" data-effect-section="crop">
          <h4 className="effect-controls-section-title">Crop</h4>
          <label className="inspector-checkbox">
            <input
              type="checkbox"
              checked={selectedLayer.cropEnabled}
              onChange={(e) => toggleCrop(e.target.checked)}
            />
            Enable Crop
          </label>
          {selectedLayer.cropEnabled && crop && (
            <>
              <div className="inspector-field-row">
                <label>X / Y</label>
                <input
                  type="number"
                  value={crop.x}
                  onChange={(e) =>
                    onCropChange({ ...crop, x: parseInt(e.target.value, 10) || 0 })
                  }
                />
                <input
                  type="number"
                  value={crop.y}
                  onChange={(e) =>
                    onCropChange({ ...crop, y: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
              <div className="inspector-field-row">
                <label>W / H</label>
                <input
                  type="number"
                  value={crop.width}
                  onChange={(e) =>
                    onCropChange({ ...crop, width: parseInt(e.target.value, 10) || 16 })
                  }
                />
                <input
                  type="number"
                  value={crop.height}
                  onChange={(e) =>
                    onCropChange({ ...crop, height: parseInt(e.target.value, 10) || 16 })
                  }
                />
              </div>
              <div className="field">
                <label>Aspect ratio</label>
                <select
                  value={selectedLayer.aspectRatio}
                  onChange={(e) =>
                    onLayerChange({ aspectRatio: e.target.value as CropAspectRatio })
                  }
                >
                  <option value="free">Free</option>
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                  <option value="4:3">4:3</option>
                </select>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetCrop}>
                Reset Crop
              </button>
            </>
          )}
        </section>

        <section className="effect-controls-section" data-effect-section="timing">
          <h4 className="effect-controls-section-title">Timing</h4>
          <div className="field">
            <label>Start in comp (sec)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={Number(selectedLayer.startTime.toFixed(2))}
              onChange={(e) => updateStartTime(e.target.value)}
            />
          </div>
          <div className="field">
            <label>In point (sec)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={Number(selectedLayer.inPoint.toFixed(2))}
              onChange={(e) => updateInPoint(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Out point (sec)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={Number(selectedLayer.outPoint.toFixed(2))}
              onChange={(e) => updateOutPoint(e.target.value)}
            />
          </div>
          <div className="effect-controls-row">
            <span>Duration</span>
            <span>{formatTimecode(layerDur)}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetTiming}>
            Reset Timing
          </button>
        </section>

        <section className="effect-controls-section" data-effect-section="effects">
          <div className="effect-controls-section-head">
            <h4 className="effect-controls-section-title">Effects</h4>
            <div className="effect-add-wrap">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAddMenuOpen((open) => !open)}
              >
                + Add Effect
              </button>
              {addMenuOpen && (
                <div className="effect-add-menu">
                  {EFFECT_MENU_GROUPS.map((group) => (
                    <div key={group.label} className="effect-add-group">
                      <div className="effect-add-group-label">{group.label}</div>
                      {group.items.map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          className="effect-add-item"
                          onClick={() => handleAddEffect(item.type)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {effects.length === 0 && (
            <p className="effect-controls-hint">No effects yet. Add an effect to build the stack.</p>
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
                {effect.type === "vidstab" && (
                  <span className="effect-capability-badge effect-capability-analyze">Analyze</span>
                )}
                {isEffectRenderOnly(effect.type) && (
                  <span className="effect-render-only">Render only</span>
                )}
                <div className="effect-item-actions">
                  <button
                    type="button"
                    className="effect-item-action"
                    disabled={index === 0}
                    onClick={() =>
                      updateEffects((current) => moveEffect(current, effect.id, -1))
                    }
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="effect-item-action"
                    disabled={index === effects.length - 1}
                    onClick={() =>
                      updateEffects((current) => moveEffect(current, effect.id, 1))
                    }
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="effect-item-action effect-item-delete"
                    onClick={() =>
                      updateEffects((current) => current.filter((entry) => entry.id !== effect.id))
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
                    filtersAvailable={
                      effect.type === "vidstab"
                        ? isEffectAvailable(getCatalogEffectById("vidstab")!)
                        : true
                    }
                    analysisBusy={analysisBusyEffectId === effect.id}
                    onAnalyzeVidstab={() =>
                      onVidstabAnalyze?.(selectedLayer.id, effect)
                    }
                    onClearVidstab={() => handleVidstabClear(effect)}
                  />
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
