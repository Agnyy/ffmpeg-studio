import { useEffect, useRef } from "react";
import { getBasename, getDirname } from "../../shared/pathUtils";
import type { ClipEditState, CropAspectRatio, CropRect } from "../../shared/clipEdit";
import { createDefaultCrop } from "../../shared/clipEdit";
import type { LayerTransform } from "../../shared/transform";
import type { TimelineLayer } from "../../shared/project";
import { layerDuration } from "../../shared/project";
import type { MediaInfo } from "../../shared/types";
import type { RenderRange } from "../../shared/projectDocument";
import { formatResolution } from "../utils/format";
import {
  centerTransform,
  fillTransform,
  fitTransform,
  getLayerSourceSize,
  resetTransform,
} from "../utils/layerTransform";
import { clampTrimRange, formatTimecode, parseTimeInput } from "../utils/time";
import { buildEditClipOutputPath } from "../../ffmpeg/editCommandBuilder";

export type InspectorSection = "transform" | "crop" | "timing" | "layer";

type InspectorPanelProps = {
  inputPath: string | null;
  mediaInfo?: MediaInfo;
  selectedLayer: TimelineLayer | null;
  editState: ClipEditState | null;
  sourceDuration: number;
  compWidth: number;
  compHeight: number;
  onEditChange: (patch: Partial<ClipEditState>) => void;
  onLayerChange: (patch: Partial<TimelineLayer>) => void;
  onTransformChange: (patch: Partial<LayerTransform>) => void;
  onCropChange: (crop: CropRect) => void;
  videoWidth: number;
  videoHeight: number;
  workAreaStart?: number;
  workAreaEnd?: number;
  renderRange?: RenderRange;
  onRenderRangeChange?: (range: RenderRange) => void;
  focusRequest?: InspectorSection | null;
};

export default function InspectorPanel({
  inputPath,
  mediaInfo,
  selectedLayer,
  editState,
  sourceDuration,
  compWidth,
  compHeight,
  onEditChange,
  onLayerChange,
  onTransformChange,
  onCropChange,
  videoWidth,
  videoHeight,
  workAreaStart = 0,
  workAreaEnd = 0,
  renderRange = "full",
  onRenderRangeChange,
  focusRequest,
}: InspectorPanelProps) {
  const transformPosXRef = useRef<HTMLInputElement>(null);
  const transformScaleRef = useRef<HTMLInputElement>(null);
  const transformRotationRef = useRef<HTMLInputElement>(null);
  const transformOpacityRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    if (focusRequest === "transform") {
      transformPosXRef.current?.focus();
    } else if (focusRequest === "crop") {
      document.getElementById("crop-x")?.focus();
    } else if (focusRequest === "timing") {
      document.getElementById("layer-start")?.focus();
    }
  }, [focusRequest]);

  if (!inputPath || !editState || !selectedLayer) {
    return (
      <aside className="inspector">
        <div className="inspector-header">
          <h2 className="inspector-header-title">Inspector</h2>
        </div>
        <div className="inspector-body">
          <p className="empty-sidebar">Select a layer to edit transform, timing, crop, and export.</p>
        </div>
      </aside>
    );
  }

  const outputPath = buildEditClipOutputPath(inputPath);
  const layerDur = layerDuration(selectedLayer);
  const transform = selectedLayer.transform;
  const layerSource = getLayerSourceSize(
    videoWidth || mediaInfo?.width || 0,
    videoHeight || mediaInfo?.height || 0,
    editState.crop,
    editState.cropEnabled
  );

  const updateTransform = (patch: Partial<LayerTransform>) => {
    onTransformChange(patch);
  };

  const updateStartTime = (value: string) => {
    const next = Math.max(0, parseTimeInput(value));
    onLayerChange({ startTime: next });
  };

  const updateInPoint = (value: string) => {
    const nextIn = parseTimeInput(value, sourceDuration);
    const next = clampTrimRange(nextIn, selectedLayer.outPoint, sourceDuration);
    onLayerChange({ inPoint: next.trimStart });
    onEditChange({ trimStart: next.trimStart, trimEnd: next.trimEnd });
  };

  const updateOutPoint = (value: string) => {
    const nextOut = parseTimeInput(value, sourceDuration);
    const next = clampTrimRange(selectedLayer.inPoint, nextOut, sourceDuration);
    onLayerChange({ outPoint: next.trimEnd });
    onEditChange({ trimStart: next.trimStart, trimEnd: next.trimEnd });
  };

  const resetTiming = () => {
    const next = clampTrimRange(0, sourceDuration, sourceDuration);
    onLayerChange({ startTime: 0, inPoint: next.trimStart, outPoint: next.trimEnd });
    onEditChange({ ...next, currentTime: 0 });
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
    onEditChange({
      cropEnabled: enabled,
      crop: enabled
        ? editState.crop ?? (vw && vh ? createDefaultCrop(vw, vh) : undefined)
        : editState.crop,
    });
  };

  const crop = editState.crop;

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <h2 className="inspector-header-title">Inspector</h2>
      </div>

      <div className="inspector-body">
        <div className="inspector-block" data-inspector-section="layer">
          <h3 className="inspector-block-title">Layer</h3>
          <div className="inspector-row">
            <span className="inspector-row-label">Name</span>
            <span className="inspector-row-value">{selectedLayer.name}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Filename</span>
            <span className="inspector-row-value">{getBasename(inputPath)}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Source duration</span>
            <span className="inspector-row-value">{formatTimecode(sourceDuration)}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Resolution</span>
            <span className="inspector-row-value">
              {formatResolution(mediaInfo?.width, mediaInfo?.height)}
            </span>
          </div>
        </div>

        <div className="inspector-block" data-inspector-section="transform">
          <h3 className="inspector-block-title">Transform</h3>
          <div className="inspector-field-row">
            <label htmlFor="transform-pos-x">Position X</label>
            <input
              ref={transformPosXRef}
              id="transform-pos-x"
              type="number"
              step={1}
              value={Math.round(transform.positionX)}
              onChange={(e) => updateTransform({ positionX: parseFloat(e.target.value) || 0 })}
            />
            <input
              id="transform-pos-y"
              type="number"
              step={1}
              value={Math.round(transform.positionY)}
              onChange={(e) => updateTransform({ positionY: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="inspector-field-row">
            <label htmlFor="transform-scale-x">Scale X</label>
            <input
              ref={transformScaleRef}
              id="transform-scale-x"
              type="number"
              step={0.1}
              value={Number(transform.scaleX.toFixed(1))}
              onChange={(e) => {
                const next = parseFloat(e.target.value) || 100;
                updateTransform(
                  editState.uniformScale
                    ? { scaleX: next, scaleY: next }
                    : { scaleX: next }
                );
              }}
            />
            <input
              id="transform-scale-y"
              type="number"
              step={0.1}
              value={Number(transform.scaleY.toFixed(1))}
              disabled={editState.uniformScale}
              onChange={(e) => updateTransform({ scaleY: parseFloat(e.target.value) || 100 })}
            />
          </div>
          <label className="inspector-checkbox">
            <input
              type="checkbox"
              checked={editState.uniformScale}
              onChange={(e) => onEditChange({ uniformScale: e.target.checked })}
            />
            Uniform scale
          </label>
          <div className="field">
            <label htmlFor="transform-rotation">Rotation (°)</label>
            <input
              ref={transformRotationRef}
              id="transform-rotation"
              type="number"
              step={0.1}
              value={Number(transform.rotation.toFixed(1))}
              onChange={(e) => updateTransform({ rotation: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="field">
            <label htmlFor="transform-opacity">Opacity (%)</label>
            <input
              ref={transformOpacityRef}
              id="transform-opacity"
              type="number"
              min={0}
              max={100}
              step={1}
              value={Math.round(transform.opacity)}
              onChange={(e) =>
                updateTransform({
                  opacity: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)),
                })
              }
            />
          </div>
          <div className="inspector-field-row">
            <label htmlFor="transform-anchor-x">Anchor X</label>
            <input
              id="transform-anchor-x"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={Number(transform.anchorX.toFixed(2))}
              onChange={(e) => updateTransform({ anchorX: parseFloat(e.target.value) || 0 })}
            />
            <input
              id="transform-anchor-y"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={Number(transform.anchorY.toFixed(2))}
              onChange={(e) => updateTransform({ anchorY: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="inspector-transform-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => updateTransform(centerTransform(compWidth, compHeight, transform))}
            >
              Center
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                updateTransform(
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
                updateTransform(
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
              onClick={() => updateTransform(resetTransform(compWidth, compHeight))}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="inspector-block" data-inspector-section="timing">
          <h3 className="inspector-block-title">Timing</h3>
          <div className="field">
            <label htmlFor="layer-start">Start time in comp (sec)</label>
            <input
              id="layer-start"
              type="number"
              min={0}
              step={0.01}
              value={Number(selectedLayer.startTime.toFixed(2))}
              onChange={(e) => updateStartTime(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="layer-in">In point (sec)</label>
            <input
              id="layer-in"
              type="number"
              min={0}
              step={0.01}
              value={Number(selectedLayer.inPoint.toFixed(2))}
              onChange={(e) => updateInPoint(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="layer-out">Out point (sec)</label>
            <input
              id="layer-out"
              type="number"
              min={0}
              step={0.01}
              value={Number(selectedLayer.outPoint.toFixed(2))}
              onChange={(e) => updateOutPoint(e.target.value)}
            />
          </div>
          <div className="inspector-static-row">
            <span className="inspector-static-label">Layer duration</span>
            <span className="inspector-static-value">{formatTimecode(layerDur)}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetTiming}>
            Reset Timing
          </button>
        </div>

        <div className="inspector-block" data-inspector-section="crop">
          <h3 className="inspector-block-title">Crop</h3>
          <label className="inspector-checkbox">
            <input
              type="checkbox"
              checked={editState.cropEnabled}
              onChange={(e) => toggleCrop(e.target.checked)}
            />
            Enable Crop
          </label>

          {editState.cropEnabled && crop && (
            <>
              <div className="field">
                <label htmlFor="crop-x">X</label>
                <input
                  id="crop-x"
                  type="number"
                  value={crop.x}
                  onChange={(e) =>
                    onCropChange({ ...crop, x: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="crop-y">Y</label>
                <input
                  id="crop-y"
                  type="number"
                  value={crop.y}
                  onChange={(e) =>
                    onCropChange({ ...crop, y: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="crop-w">Width</label>
                <input
                  id="crop-w"
                  type="number"
                  value={crop.width}
                  onChange={(e) =>
                    onCropChange({ ...crop, width: parseInt(e.target.value, 10) || 16 })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="crop-h">Height</label>
                <input
                  id="crop-h"
                  type="number"
                  value={crop.height}
                  onChange={(e) =>
                    onCropChange({ ...crop, height: parseInt(e.target.value, 10) || 16 })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="crop-aspect">Aspect ratio</label>
                <select
                  id="crop-aspect"
                  value={editState.aspectRatio}
                  onChange={(e) =>
                    onEditChange({ aspectRatio: e.target.value as CropAspectRatio })
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
        </div>

        <div className="inspector-block">
          <h3 className="inspector-block-title">Export</h3>
          <div className="inspector-row">
            <span className="inspector-row-label">Work Area Start</span>
            <span className="inspector-row-value">{formatTimecode(workAreaStart)}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Work Area End</span>
            <span className="inspector-row-value">{formatTimecode(workAreaEnd)}</span>
          </div>
          <div className="field">
            <label htmlFor="export-render-range">Render Range</label>
            <select
              id="export-render-range"
              value={renderRange}
              onChange={(e) => onRenderRangeChange?.(e.target.value as RenderRange)}
            >
              <option value="full">Full Layer</option>
              <option value="workArea">Work Area</option>
            </select>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Format</span>
            <span className="inspector-row-value">MP4</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Composition</span>
            <span className="inspector-row-value">
              {compWidth}x{compHeight}
            </span>
          </div>
          {selectedLayer.muted && (
            <div className="inspector-warning">Audio muted — render will exclude audio track.</div>
          )}
          {!selectedLayer.enabled && (
            <div className="inspector-warning">Layer hidden — render may not reflect visibility.</div>
          )}
          <div className="field">
            <label htmlFor="export-crf">Quality (CRF)</label>
            <input
              id="export-crf"
              type="number"
              min={0}
              max={51}
              value={editState.exportCrf}
              onChange={(e) =>
                onEditChange({ exportCrf: parseInt(e.target.value, 10) || 23 })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="export-preset">Encoding preset</label>
            <select
              id="export-preset"
              value={editState.exportPreset}
              onChange={(e) => onEditChange({ exportPreset: e.target.value })}
            >
              <option value="ultrafast">ultrafast</option>
              <option value="fast">fast</option>
              <option value="medium">medium</option>
              <option value="slow">slow</option>
            </select>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Output folder</span>
            <span className="inspector-row-value">{getDirname(outputPath)}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Output filename</span>
            <span className="inspector-row-value">{getBasename(outputPath)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
