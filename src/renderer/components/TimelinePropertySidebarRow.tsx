import { Diamond, Timer } from "lucide-react";
import type { CropRect } from "../../shared/clipEdit";
import { createDefaultCrop } from "../../shared/clipEdit";
import type { LayerEffect } from "../../shared/effects";
import type { LayerTransform } from "../../shared/transform";
import type { TimelineLayer } from "../../shared/project";
import type { TransformGroupKey } from "../../keyframes/keyframeTypes";
import { getEffectParamDefinitions } from "../../keyframes/effectKeyframes";
import {
  getEffectiveEffectParam,
  hasEffectKeyframeAtTime,
  isEffectParamAnimationEnabled,
} from "../../keyframes/layerEffectKeyframes";
import {
  getEffectiveLayerTransform,
  hasKeyframeAtTime,
  isTransformGroupEnabled,
} from "../../keyframes/layerTransformKeyframes";
import ScrubbableNumber, {
  formatDecibelValue,
  formatOpacityValue,
  formatPositionValue,
  formatRotationValue,
  formatScaleValue,
  parseDecibelToLinear,
} from "./ScrubbableNumber";

export type PropertyRow =
  | { kind: "video" }
  | { kind: "audio" }
  | { kind: "audio-levels" }
  | { kind: "waveform" }
  | { kind: "transform" }
  | { kind: "keyframe-position" }
  | { kind: "keyframe-scale" }
  | { kind: "keyframe-rotation" }
  | { kind: "keyframe-opacity" }
  | { kind: "anchor" }
  | { kind: "crop" }
  | { kind: "crop-field"; field: keyof CropRect; label: string }
  | { kind: "effects" }
  | { kind: "effect"; effectId: string; label: string }
  | { kind: "effect-param"; effectId: string; param: string; label: string }
  | { kind: "timing" };

const KF_GROUP_BY_ROW: Record<string, TransformGroupKey> = {
  "keyframe-position": "position",
  "keyframe-scale": "scale",
  "keyframe-rotation": "rotation",
  "keyframe-opacity": "opacity",
};

type TimelinePropertySidebarRowProps = {
  layer: TimelineLayer;
  row: PropertyRow;
  height: number;
  compCurrentTime: number;
  compWidth: number;
  compHeight: number;
  highlighted?: boolean;
  hovered?: boolean;
  onRowHover?: (rowKey: string | null) => void;
  rowKey?: string;
  onSelectLayer: (layerId: string) => void;
  onToggleExpand: (layer: TimelineLayer, row: PropertyRow) => void;
  onTransformChange: (layerId: string, patch: Partial<LayerTransform>) => void;
  onToggleTransformAnimation: (layerId: string, group: TransformGroupKey) => void;
  onToggleKeyframeDiamond: (layerId: string, group: TransformGroupKey) => void;
  onToggleEffectParamAnimation: (layerId: string, effectId: string, param: string) => void;
  onToggleEffectParamDiamond: (layerId: string, effectId: string, param: string) => void;
  onEffectParamChange: (layerId: string, effectId: string, param: string, value: number) => void;
  onLayerChange: (layerId: string, patch: Partial<TimelineLayer>) => void;
  renderLabel: (row: PropertyRow, layer: TimelineLayer) => React.ReactNode;
};

function stopBubble(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function PropertyRowShell({
  highlighted,
  hovered,
  animated,
  onSelect,
  onRowHover,
  rowKey,
  children,
}: {
  highlighted?: boolean;
  hovered?: boolean;
  animated?: boolean;
  onSelect: () => void;
  onRowHover?: (rowKey: string | null) => void;
  rowKey?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`timeline-property-row ${highlighted ? "timeline-property-row-highlighted" : ""} ${
        hovered ? "timeline-property-row-hovered" : ""
      } ${animated ? "timeline-property-row-animated" : ""}`}
      onClick={onSelect}
      onMouseEnter={() => rowKey && onRowHover?.(rowKey)}
      onMouseLeave={() => onRowHover?.(null)}
    >
      {children}
    </div>
  );
}

function TransformInlineRow({
  layer,
  group,
  compCurrentTime,
  highlighted = false,
  hovered = false,
  onRowHover,
  rowKey,
  onSelectLayer,
  onTransformChange,
  onToggleTransformAnimation,
  onToggleKeyframeDiamond,
}: {
  layer: TimelineLayer;
  group: TransformGroupKey;
  compCurrentTime: number;
  highlighted?: boolean;
  hovered?: boolean;
  onRowHover?: (rowKey: string | null) => void;
  rowKey?: string;
  onSelectLayer: (layerId: string) => void;
  onTransformChange: (layerId: string, patch: Partial<LayerTransform>) => void;
  onToggleTransformAnimation: (layerId: string, group: TransformGroupKey) => void;
  onToggleKeyframeDiamond: (layerId: string, group: TransformGroupKey) => void;
}) {
  const enabled = isTransformGroupEnabled(layer.keyframes, group);
  const hasDiamond = hasKeyframeAtTime(layer.keyframes, group, compCurrentTime);
  const transform = getEffectiveLayerTransform(layer, compCurrentTime);

  const labels: Record<TransformGroupKey, string> = {
    position: "Position",
    scale: "Scale",
    rotation: "Rotation",
    opacity: "Opacity",
  };

  const renderValues = () => {
    switch (group) {
      case "position":
        return (
          <>
            <ScrubbableNumber
              value={transform.positionX}
              formatValue={formatPositionValue}
              onFocus={() => onSelectLayer(layer.id)}
              onChange={(positionX) => onTransformChange(layer.id, { positionX })}
            />
            <span className="timeline-property-value-sep">,</span>
            <ScrubbableNumber
              value={transform.positionY}
              formatValue={formatPositionValue}
              onFocus={() => onSelectLayer(layer.id)}
              onChange={(positionY) => onTransformChange(layer.id, { positionY })}
            />
          </>
        );
      case "scale":
        return (
          <>
            <ScrubbableNumber
              value={transform.scaleX}
              formatValue={formatScaleValue}
              min={0}
              onFocus={() => onSelectLayer(layer.id)}
              onChange={(scaleX) => onTransformChange(layer.id, { scaleX })}
            />
            <span className="timeline-property-value-sep">,</span>
            <ScrubbableNumber
              value={transform.scaleY}
              formatValue={formatScaleValue}
              min={0}
              onFocus={() => onSelectLayer(layer.id)}
              onChange={(scaleY) => onTransformChange(layer.id, { scaleY })}
            />
          </>
        );
      case "rotation":
        return (
          <ScrubbableNumber
            value={transform.rotation}
            formatValue={formatRotationValue}
            step={0.1}
            sensitivity={0.05}
            onFocus={() => onSelectLayer(layer.id)}
            onChange={(rotation) => onTransformChange(layer.id, { rotation })}
          />
        );
      case "opacity":
        return (
          <ScrubbableNumber
            value={transform.opacity}
            formatValue={formatOpacityValue}
            min={0}
            max={100}
            onFocus={() => onSelectLayer(layer.id)}
            onChange={(opacity) => onTransformChange(layer.id, { opacity })}
          />
        );
    }
  };

  const stopwatchTitle = enabled
    ? `Disable animation for ${labels[group]}`
    : `Enable animation for ${labels[group]}`;

  return (
    <PropertyRowShell
      highlighted={highlighted}
      hovered={hovered}
      animated={enabled}
      onSelect={() => onSelectLayer(layer.id)}
      onRowHover={onRowHover}
      rowKey={rowKey}
    >
      <span className="timeline-property-twirl" />
      <button
        type="button"
        className={`timeline-inline-stopwatch ${enabled ? "active" : ""}`}
        onClick={(e) => {
          stopBubble(e);
          onSelectLayer(layer.id);
          onToggleTransformAnimation(layer.id, group);
        }}
        title={stopwatchTitle}
      >
        <Timer size={16} />
      </button>
      <span className="timeline-property-name">{labels[group]}</span>
      <div
        className={`timeline-property-values ${
          group === "position" || group === "scale" ? "timeline-property-values-pair" : ""
        }`}
      >
        {renderValues()}
      </div>
      <button
        type="button"
        className={`timeline-inline-diamond ${hasDiamond ? "active filled" : ""}`}
        onClick={(e) => {
          stopBubble(e);
          onSelectLayer(layer.id);
          onToggleKeyframeDiamond(layer.id, group);
        }}
        title="Add/remove keyframe at current time"
      >
        <Diamond size={16} fill={hasDiamond ? "currentColor" : "none"} />
      </button>
    </PropertyRowShell>
  );
}

function AnchorInlineRow({
  layer,
  compWidth,
  compHeight,
  highlighted = false,
  hovered = false,
  onRowHover,
  rowKey,
  onSelectLayer,
  onTransformChange,
}: {
  layer: TimelineLayer;
  compWidth: number;
  compHeight: number;
  highlighted?: boolean;
  hovered?: boolean;
  onRowHover?: (rowKey: string | null) => void;
  rowKey?: string;
  onSelectLayer: (layerId: string) => void;
  onTransformChange: (layerId: string, patch: Partial<LayerTransform>) => void;
}) {
  const transform = layer.transform;
  const anchorPixelX = transform.anchorX * compWidth;
  const anchorPixelY = transform.anchorY * compHeight;

  return (
    <PropertyRowShell
      highlighted={highlighted}
      hovered={hovered}
      onSelect={() => onSelectLayer(layer.id)}
      onRowHover={onRowHover}
      rowKey={rowKey}
    >
      <span className="timeline-property-twirl" />
      <span className="timeline-inline-stopwatch timeline-inline-stopwatch-spacer" />
      <span className="timeline-property-name">Anchor Point</span>
      <div className="timeline-property-values timeline-property-values-pair">
        <ScrubbableNumber
          value={anchorPixelX}
          formatValue={formatPositionValue}
          min={0}
          max={compWidth}
          onFocus={() => onSelectLayer(layer.id)}
          onChange={(px) =>
            onTransformChange(layer.id, { anchorX: compWidth > 0 ? px / compWidth : 0 })
          }
        />
        <span className="timeline-property-value-sep">,</span>
        <ScrubbableNumber
          value={anchorPixelY}
          formatValue={formatPositionValue}
          min={0}
          max={compHeight}
          onFocus={() => onSelectLayer(layer.id)}
          onChange={(py) =>
            onTransformChange(layer.id, { anchorY: compHeight > 0 ? py / compHeight : 0 })
          }
        />
      </div>
      <span className="timeline-inline-diamond timeline-inline-diamond-spacer" />
    </PropertyRowShell>
  );
}

function CropFieldInlineRow({
  layer,
  field,
  label,
  highlighted = false,
  hovered = false,
  onRowHover,
  rowKey,
  onSelectLayer,
  onLayerChange,
}: {
  layer: TimelineLayer;
  field: keyof CropRect;
  label: string;
  highlighted?: boolean;
  hovered?: boolean;
  onRowHover?: (rowKey: string | null) => void;
  rowKey?: string;
  onSelectLayer: (layerId: string) => void;
  onLayerChange: (layerId: string, patch: Partial<TimelineLayer>) => void;
}) {
  const crop = layer.crop ?? createDefaultCrop(1920, 1080);
  const value = crop[field];

  return (
    <PropertyRowShell
      highlighted={highlighted}
      hovered={hovered}
      onSelect={() => onSelectLayer(layer.id)}
      onRowHover={onRowHover}
      rowKey={rowKey}
    >
      <span className="timeline-property-twirl" />
      <span className="timeline-inline-stopwatch timeline-inline-stopwatch-spacer" />
      <span className="timeline-property-name">{label}</span>
      <div className="timeline-property-values">
        <ScrubbableNumber
          value={value}
          formatValue={formatPositionValue}
          min={field === "x" || field === "y" ? 0 : 1}
          onFocus={() => onSelectLayer(layer.id)}
          onChange={(next) =>
            onLayerChange(layer.id, {
              crop: { ...crop, [field]: Math.round(next) },
            })
          }
        />
      </div>
      <span className="timeline-inline-diamond timeline-inline-diamond-spacer" />
    </PropertyRowShell>
  );
}

function getVolumeEffect(layer: TimelineLayer): LayerEffect | undefined {
  return (layer.effects ?? []).find((effect) => effect.type === "audioVolume");
}

function AudioLevelsInlineRow({
  layer,
  compCurrentTime,
  highlighted = false,
  hovered = false,
  onRowHover,
  rowKey,
  onSelectLayer,
  onToggleEffectParamAnimation,
  onToggleEffectParamDiamond,
  onEffectParamChange,
}: {
  layer: TimelineLayer;
  compCurrentTime: number;
  highlighted?: boolean;
  hovered?: boolean;
  onRowHover?: (rowKey: string | null) => void;
  rowKey?: string;
  onSelectLayer: (layerId: string) => void;
  onToggleEffectParamAnimation: (layerId: string, effectId: string, param: string) => void;
  onToggleEffectParamDiamond: (layerId: string, effectId: string, param: string) => void;
  onEffectParamChange: (layerId: string, effectId: string, param: string, value: number) => void;
}) {
  const volumeEffect = getVolumeEffect(layer);
  const enabled = volumeEffect
    ? isEffectParamAnimationEnabled(volumeEffect, "volume")
    : false;
  const hasDiamond = volumeEffect
    ? hasEffectKeyframeAtTime(volumeEffect, "volume", compCurrentTime)
    : false;
  const linearVolume = volumeEffect
    ? getEffectiveEffectParam(volumeEffect, "volume", compCurrentTime)
    : 1;

  return (
    <PropertyRowShell
      highlighted={highlighted}
      hovered={hovered}
      animated={enabled}
      onSelect={() => onSelectLayer(layer.id)}
      onRowHover={onRowHover}
      rowKey={rowKey}
    >
      <span className="timeline-property-twirl" />
      <button
        type="button"
        className={`timeline-inline-stopwatch ${enabled ? "active" : ""}`}
        disabled={!volumeEffect}
        onClick={(e) => {
          stopBubble(e);
          if (!volumeEffect) {
            return;
          }
          onSelectLayer(layer.id);
          onToggleEffectParamAnimation(layer.id, volumeEffect.id, "volume");
        }}
        title={enabled ? "Disable animation" : "Enable animation"}
      >
        <Timer size={16} />
      </button>
      <span className="timeline-property-name">Audio Levels</span>
      <div className="timeline-property-values">
        <ScrubbableNumber
          value={linearVolume}
          formatValue={formatDecibelValue}
          parseValue={parseDecibelToLinear}
          min={0}
          max={2}
          step={0.01}
          sensitivity={0.002}
          disabled={!volumeEffect}
          onFocus={() => onSelectLayer(layer.id)}
          onChange={(volume) => {
            if (!volumeEffect) {
              return;
            }
            onEffectParamChange(layer.id, volumeEffect.id, "volume", volume);
          }}
        />
      </div>
      <button
        type="button"
        className={`timeline-inline-diamond ${hasDiamond ? "active filled" : ""}`}
        disabled={!volumeEffect}
        onClick={(e) => {
          stopBubble(e);
          if (!volumeEffect) {
            return;
          }
          onSelectLayer(layer.id);
          onToggleEffectParamDiamond(layer.id, volumeEffect.id, "volume");
        }}
        title="Add/remove keyframe at current time"
      >
        <Diamond size={16} fill={hasDiamond ? "currentColor" : "none"} />
      </button>
    </PropertyRowShell>
  );
}

function EffectParamInlineRow({
  layer,
  effect,
  param,
  label,
  compCurrentTime,
  highlighted = false,
  hovered = false,
  onRowHover,
  rowKey,
  onSelectLayer,
  onToggleEffectParamAnimation,
  onToggleEffectParamDiamond,
  onEffectParamChange,
}: {
  layer: TimelineLayer;
  effect: LayerEffect;
  param: string;
  label: string;
  compCurrentTime: number;
  highlighted?: boolean;
  hovered?: boolean;
  onRowHover?: (rowKey: string | null) => void;
  rowKey?: string;
  onSelectLayer: (layerId: string) => void;
  onToggleEffectParamAnimation: (layerId: string, effectId: string, param: string) => void;
  onToggleEffectParamDiamond: (layerId: string, effectId: string, param: string) => void;
  onEffectParamChange: (layerId: string, effectId: string, param: string, value: number) => void;
}) {
  const enabled = isEffectParamAnimationEnabled(effect, param);
  const hasDiamond = hasEffectKeyframeAtTime(effect, param, compCurrentTime);
  const value = getEffectiveEffectParam(effect, param, compCurrentTime);
  const def = getEffectParamDefinitions(effect.type).find((entry) => entry.param === param);

  return (
    <PropertyRowShell
      highlighted={highlighted}
      hovered={hovered}
      animated={enabled}
      onSelect={() => onSelectLayer(layer.id)}
      onRowHover={onRowHover}
      rowKey={rowKey}
    >
      <span className="timeline-property-twirl" />
      <button
        type="button"
        className={`timeline-inline-stopwatch ${enabled ? "active" : ""}`}
        onClick={(e) => {
          stopBubble(e);
          onSelectLayer(layer.id);
          onToggleEffectParamAnimation(layer.id, effect.id, param);
        }}
        title={enabled ? "Disable animation" : "Enable animation"}
      >
        <Timer size={16} />
      </button>
      <span className="timeline-property-name">{label}</span>
      <div className="timeline-property-values">
        <ScrubbableNumber
          value={value}
          formatValue={(v) => v.toFixed(def?.param === "radius" ? 1 : 2)}
          min={def?.min}
          max={def?.max}
          step={def?.param === "radius" ? 0.5 : 0.05}
          sensitivity={def?.param === "radius" ? 0.05 : 0.01}
          onFocus={() => onSelectLayer(layer.id)}
          onChange={(next) => onEffectParamChange(layer.id, effect.id, param, next)}
        />
      </div>
      <button
        type="button"
        className={`timeline-inline-diamond ${hasDiamond ? "active filled" : ""}`}
        onClick={(e) => {
          stopBubble(e);
          onSelectLayer(layer.id);
          onToggleEffectParamDiamond(layer.id, effect.id, param);
        }}
        title="Add/remove keyframe at current time"
      >
        <Diamond size={16} fill={hasDiamond ? "currentColor" : "none"} />
      </button>
    </PropertyRowShell>
  );
}

export default function TimelinePropertySidebarRow({
  layer,
  row,
  height,
  compCurrentTime,
  compWidth,
  compHeight,
  highlighted = false,
  hovered = false,
  onRowHover,
  rowKey,
  onSelectLayer,
  onToggleExpand,
  onTransformChange,
  onToggleTransformAnimation,
  onToggleKeyframeDiamond,
  onToggleEffectParamAnimation,
  onToggleEffectParamDiamond,
  onEffectParamChange,
  onLayerChange,
  renderLabel,
}: TimelinePropertySidebarRowProps) {
  const group = KF_GROUP_BY_ROW[row.kind];
  if (group) {
    return (
      <div className="timeline-layer-child timeline-layer-child-inline" style={{ height }}>
        <TransformInlineRow
          layer={layer}
          group={group}
          compCurrentTime={compCurrentTime}
          highlighted={highlighted}
          hovered={hovered}
          onRowHover={onRowHover}
          rowKey={rowKey}
          onSelectLayer={onSelectLayer}
          onTransformChange={onTransformChange}
          onToggleTransformAnimation={onToggleTransformAnimation}
          onToggleKeyframeDiamond={onToggleKeyframeDiamond}
        />
      </div>
    );
  }

  if (row.kind === "anchor") {
    return (
      <div className="timeline-layer-child timeline-layer-child-inline" style={{ height }}>
        <AnchorInlineRow
          layer={layer}
          compWidth={compWidth}
          compHeight={compHeight}
          highlighted={highlighted}
          hovered={hovered}
          onRowHover={onRowHover}
          rowKey={rowKey}
          onSelectLayer={onSelectLayer}
          onTransformChange={onTransformChange}
        />
      </div>
    );
  }

  if (row.kind === "crop-field") {
    return (
      <div className="timeline-layer-child timeline-layer-child-inline" style={{ height }}>
        <CropFieldInlineRow
          layer={layer}
          field={row.field}
          label={row.label}
          highlighted={highlighted}
          hovered={hovered}
          onRowHover={onRowHover}
          rowKey={rowKey}
          onSelectLayer={onSelectLayer}
          onLayerChange={onLayerChange}
        />
      </div>
    );
  }

  if (row.kind === "audio-levels") {
    return (
      <div className="timeline-layer-child timeline-layer-child-inline" style={{ height }}>
        <AudioLevelsInlineRow
          layer={layer}
          compCurrentTime={compCurrentTime}
          highlighted={highlighted}
          hovered={hovered}
          onRowHover={onRowHover}
          rowKey={rowKey}
          onSelectLayer={onSelectLayer}
          onToggleEffectParamAnimation={onToggleEffectParamAnimation}
          onToggleEffectParamDiamond={onToggleEffectParamDiamond}
          onEffectParamChange={onEffectParamChange}
        />
      </div>
    );
  }

  if (row.kind === "effect-param") {
    const effect = layer.effects?.find((entry) => entry.id === row.effectId);
    if (!effect) {
      return null;
    }
    return (
      <div className="timeline-layer-child timeline-layer-child-inline" style={{ height }}>
        <EffectParamInlineRow
          layer={layer}
          effect={effect}
          param={row.param}
          label={row.label}
          compCurrentTime={compCurrentTime}
          highlighted={highlighted}
          hovered={hovered}
          onRowHover={onRowHover}
          rowKey={rowKey}
          onSelectLayer={onSelectLayer}
          onToggleEffectParamAnimation={onToggleEffectParamAnimation}
          onToggleEffectParamDiamond={onToggleEffectParamDiamond}
          onEffectParamChange={onEffectParamChange}
        />
      </div>
    );
  }

  const isExpandable =
    row.kind === "transform" ||
    row.kind === "effect" ||
    row.kind === "audio" ||
    row.kind === "crop" ||
    row.kind === "waveform";
  return (
    <button
      type="button"
      className={`timeline-layer-child ${highlighted ? "timeline-layer-child-highlighted" : ""}`}
      style={{ height }}
      onClick={() => {
        onSelectLayer(layer.id);
        if (isExpandable) {
          onToggleExpand(layer, row);
        }
      }}
    >
      <span className="timeline-layer-child-inner">{renderLabel(row, layer)}</span>
    </button>
  );
}
