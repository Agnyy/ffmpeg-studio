import { getBasename, getDirname } from "../../shared/pathUtils";
import type { ExportSettings, RenderRange } from "../../shared/projectDocument";
import type { ProjectItem, TimelineLayer } from "../../shared/project";
import RenderCompatPanel from "./RenderCompatPanel";
import BatchExportSection from "./BatchExportSection";
import type { MediaInfo } from "../../shared/types";
import type { CompositionRenderRange } from "../../ffmpeg/compositionRenderBuilder";
import type { BatchApplyOptions } from "./BatchApplyRecipeDialog";
import { formatTimecode } from "../utils/time";

type ExportPanelProps = {
  compositionName: string | null;
  inputPath: string | null;
  mediaInfo?: MediaInfo;
  timelineLayers: TimelineLayer[];
  selectedLayer: TimelineLayer | null;
  selectedFootageItems?: ProjectItem[];
  exportSettings: ExportSettings;
  compWidth: number;
  compHeight: number;
  workAreaStart: number;
  workAreaEnd: number;
  renderRange: RenderRange;
  resolvedRenderRange: CompositionRenderRange;
  outputPath: string;
  canRender: boolean;
  isRunning: boolean;
  onRenderRangeChange: (range: RenderRange) => void;
  onExportSettingsChange: (patch: Partial<ExportSettings>) => void;
  onRender: () => void;
  onBatchApply?: (options: BatchApplyOptions) => void;
};

export default function ExportPanel({
  compositionName,
  timelineLayers,
  selectedLayer,
  exportSettings,
  compWidth,
  compHeight,
  workAreaStart,
  workAreaEnd,
  renderRange,
  resolvedRenderRange,
  outputPath,
  canRender,
  isRunning,
  selectedFootageItems = [],
  onRenderRangeChange,
  onExportSettingsChange,
  onRender,
  onBatchApply,
}: ExportPanelProps) {
  const renderDuration = Math.max(0, resolvedRenderRange.end - resolvedRenderRange.start);
  const exportCrf = exportSettings.exportCrf;
  const exportPreset = exportSettings.exportPreset;

  if (!compositionName) {
    return (
      <div className="export-panel">
        <p className="export-panel-empty">Open a composition to configure export.</p>
      </div>
    );
  }

  return (
    <div className="export-panel">
      <div className="export-panel-block">
        <h3 className="export-panel-title">Single Export</h3>
      </div>

      <div className="export-panel-block">
        <h3 className="export-panel-subtitle">Composition</h3>
        <div className="export-panel-row">
          <span className="export-panel-label">Name</span>
          <span className="export-panel-value">{compositionName}</span>
        </div>
        <div className="export-panel-row">
          <span className="export-panel-label">Resolution</span>
          <span className="export-panel-value">
            {compWidth}×{compHeight}
          </span>
        </div>
        {selectedLayer && (
          <div className="export-panel-row">
            <span className="export-panel-label">Active Layer</span>
            <span className="export-panel-value">{selectedLayer.name}</span>
          </div>
        )}
      </div>

      <div className="export-panel-block">
        <h3 className="export-panel-title">Render Range</h3>
        <div className="field">
          <label htmlFor="export-render-range">Range</label>
          <select
            id="export-render-range"
            value={renderRange}
            onChange={(e) => onRenderRangeChange(e.target.value as RenderRange)}
          >
            <option value="full">Full Composition</option>
            <option value="workArea">Work Area</option>
            <option value="selectedLayer">Selected Layer</option>
          </select>
        </div>
        <div className="export-panel-row">
          <span className="export-panel-label">Start</span>
          <span className="export-panel-value">{formatTimecode(resolvedRenderRange.start)}</span>
        </div>
        <div className="export-panel-row">
          <span className="export-panel-label">End</span>
          <span className="export-panel-value">{formatTimecode(resolvedRenderRange.end)}</span>
        </div>
        <div className="export-panel-row">
          <span className="export-panel-label">Duration</span>
          <span className="export-panel-value export-panel-highlight">
            {formatTimecode(renderDuration)}
          </span>
        </div>
        <div className="export-panel-row">
          <span className="export-panel-label">Work Area (B/N)</span>
          <span className="export-panel-value">
            {formatTimecode(workAreaStart)} – {formatTimecode(workAreaEnd)}
          </span>
        </div>
      </div>

      <div className="export-panel-block">
        <h3 className="export-panel-title">Output</h3>
        <div className="export-panel-row">
          <span className="export-panel-label">Format</span>
          <span className="export-panel-value">MP4 (H.264)</span>
        </div>
        <div className="export-panel-row">
          <span className="export-panel-label">Output folder</span>
          <span className="export-panel-value export-panel-path">{getDirname(outputPath)}</span>
        </div>
        <div className="export-panel-row">
          <span className="export-panel-label">Filename</span>
          <span className="export-panel-value">{getBasename(outputPath)}</span>
        </div>
      </div>

      <RenderCompatPanel layers={timelineLayers} />

      <div className="export-panel-block">
        <h3 className="export-panel-title">Encoding</h3>
        <div className="field">
          <label htmlFor="export-crf">Quality (CRF)</label>
          <input
            id="export-crf"
            type="number"
            min={0}
            max={51}
            value={exportCrf}
            onChange={(e) =>
              onExportSettingsChange({ exportCrf: parseInt(e.target.value, 10) || 23 })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="export-preset">Preset</label>
          <select
            id="export-preset"
            value={exportPreset}
            onChange={(e) => onExportSettingsChange({ exportPreset: e.target.value })}
          >
            <option value="ultrafast">ultrafast</option>
            <option value="fast">fast</option>
            <option value="medium">medium</option>
            <option value="slow">slow</option>
          </select>
        </div>
      </div>

      {selectedLayer?.muted && (
        <div className="export-panel-warning">Audio muted — render excludes audio.</div>
      )}
      {!selectedLayer?.enabled && selectedLayer && (
        <div className="export-panel-warning">Selected layer is hidden in timeline.</div>
      )}

      <button
        type="button"
        className="btn btn-primary export-panel-render"
        onClick={onRender}
        disabled={!canRender || isRunning}
      >
        {isRunning ? "Rendering…" : "Render Composition"}
      </button>

      {onBatchApply && (
        <BatchExportSection
          selectedFootageItems={selectedFootageItems}
          onApplyBatch={onBatchApply}
        />
      )}
    </div>
  );
}
