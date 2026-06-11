import type { TransformGroupKey } from "../../keyframes/keyframeTypes";
import type { SelectedKeyframeRef } from "../../keyframes/keyframeSelection";
import type { CropRect } from "../../shared/clipEdit";
import type { LayerEffect } from "../../shared/effects";
import type { LayerTransform } from "../../shared/transform";
import type { TimelineLayer } from "../../shared/project";
import type { ProjectItem } from "../../shared/project";
import type { MediaInfo } from "../../shared/types";
import EffectControlsPanel, { type EffectControlsFocus } from "./EffectControlsPanel";

type LayerControlsPanelProps = {
  inputPath: string | null;
  selectedFootageItem?: ProjectItem | null;
  proxyGeneratingIds?: Set<string>;
  onCreatePreviewProxy?: (itemId: string) => void;
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
    value: import("../../shared/effects").LayerEffectParamValue
  ) => void;
  onLayerChange: (patch: Partial<TimelineLayer>) => void;
  onTransformChange: (patch: Partial<LayerTransform>) => void;
  onCropChange: (crop: CropRect) => void;
  onEffectsChange: (effects: LayerEffect[]) => void;
};

export default function LayerControlsPanel(props: LayerControlsPanelProps) {
  const { selectedLayer, inputPath } = props;

  if (!selectedLayer || !inputPath) {
    return (
      <div className="layer-controls-panel">
        <p className="layer-controls-empty">No layer selected</p>
        <p className="layer-controls-hint">Select a layer in the timeline to edit Transform, Crop, Timing, and Effects.</p>
      </div>
    );
  }

  return (
    <div className="layer-controls-panel">
      <div className="layer-controls-header">
        <h3 className="layer-controls-title">Layer Controls</h3>
        <span className="layer-controls-layer-name">{selectedLayer.name}</span>
      </div>

      <EffectControlsPanel {...props} />
    </div>
  );
}
