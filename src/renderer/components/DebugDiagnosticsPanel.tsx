import type { CompositionRenderRange } from "../../ffmpeg/compositionRenderBuilder";
import {
  getPreviewSourceKind,
} from "../../media/mediaCompatibility";
import {
  getCachedNativePreviewResult,
  hasFailedNativePreview,
} from "../../media/nativePreviewCache";
import type { RenderRange } from "../../shared/projectDocument";
import type { ProjectItem, TimelineLayer } from "../../shared/project";
import type { EditorTool } from "../../tools/toolTypes";
import {
  getPropertyRows,
  type TimelineRevealState,
} from "../utils/timelinePropertyReveal";
import type { PlaybackDiagnostics } from "../types/playbackDiagnostics";
import type { TimelineViewMode } from "../utils/timelineZoom";
import type { Job } from "../../shared/types";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import PreviewDebugBlock from "./PreviewDebugBlock";

const IS_DEV = process.env.NODE_ENV !== "production";

type DebugDiagnosticsPanelProps = {
  selectedLayer: TimelineLayer | null;
  selectedFootageItem: ProjectItem | null;
  timelineLayers: TimelineLayer[];
  timelineRevealState: TimelineRevealState;
  timelineViewMode: TimelineViewMode;
  activeTool: EditorTool;
  compWidth: number;
  compHeight: number;
  compCurrentTime: number;
  playback: PlaybackDiagnostics;
  renderRange: RenderRange;
  resolvedRenderRange: CompositionRenderRange;
  previewPathBySourcePath: Record<string, string>;
  jobs?: Job[];
};

function propertyRowLabel(
  row: ReturnType<typeof getPropertyRows>[number]
): string {
  switch (row.kind) {
    case "keyframe-position":
      return "Position";
    case "keyframe-scale":
      return "Scale";
    case "keyframe-rotation":
      return "Rotation";
    case "keyframe-opacity":
      return "Opacity";
    case "anchor":
      return "Anchor Point";
    case "audio-levels":
      return "Audio Levels";
    case "crop-field":
      return `Crop ${row.label}`;
    case "effect-param":
      return `${row.label} (effect)`;
    case "effect":
      return row.label;
    case "transform":
      return "Transform";
    case "audio":
      return "Audio";
    case "waveform":
      return "Waveform";
    case "crop":
      return "Crop";
    case "effects":
      return "Effects";
    default:
      return row.kind;
  }
}

export default function DebugDiagnosticsPanel(props: DebugDiagnosticsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!IS_DEV) {
    return null;
  }

  const {
    selectedLayer,
    selectedFootageItem,
    timelineLayers,
    timelineRevealState,
    timelineViewMode,
    activeTool,
    compWidth,
    compHeight,
    compCurrentTime,
    playback,
    renderRange,
    resolvedRenderRange,
    previewPathBySourcePath,
    jobs = [],
  } = props;

  const sourcePath = selectedLayer?.sourcePath ?? selectedFootageItem?.path ?? null;

  const originalPath =
    selectedFootageItem?.originalPath ??
    selectedFootageItem?.path ??
    sourcePath ??
    "—";
  const previewPath = sourcePath ? previewPathBySourcePath[sourcePath] ?? "—" : "—";
  const proxyPath = selectedFootageItem?.proxyPath ?? "—";
  const compatStatus = selectedFootageItem?.compatibilityStatus ?? "—";
  const previewSourceKind = getPreviewSourceKind(selectedFootageItem);
  const nativeCache = sourcePath ? getCachedNativePreviewResult(sourcePath) : null;

  const visibleRows = selectedLayer
    ? getPropertyRows(selectedLayer, {
        reveal: timelineRevealState,
        compWidth,
        compHeight,
        selectedLayerId: selectedLayer.id,
        activeTool,
      })
    : [];

  const videoLayers = timelineLayers.filter((l) => l.enabled && l.hasVideo).length;
  const audioLayers = timelineLayers.filter(
    (l) => l.enabled && l.hasAudio && !l.muted
  ).length;

  return (
    <section className={`debug-diagnostics-panel ${expanded ? "expanded" : "collapsed"}`}>
      <button
        type="button"
        className="debug-diagnostics-toggle"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="debug-diagnostics-title">Developer Diagnostics</span>
        <span className="debug-diagnostics-hint">dev only</span>
      </button>

      {expanded && (
        <>
      {selectedFootageItem?.type === "footage" && (
        <div className="debug-diagnostics-section">
          <h4>Preview paths</h4>
          <PreviewDebugBlock item={selectedFootageItem} jobs={jobs} />
        </div>
      )}

      <div className="debug-diagnostics-section">
        <h4>Media source</h4>
        <dl className="debug-diagnostics-dl">
          <dt>Original path</dt>
          <dd>{originalPath}</dd>
          <dt>Preview source</dt>
          <dd>{previewSourceKind}</dd>
          <dt>compatibilityStatus</dt>
          <dd>{compatStatus}</dd>
          <dt>previewPath</dt>
          <dd>{selectedFootageItem?.previewPath ?? previewPath}</dd>
          <dt>Proxy path</dt>
          <dd>{proxyPath}</dd>
          <dt>Native cache</dt>
          <dd>
            {nativeCache
              ? nativeCache.ok
                ? "ok"
                : `failed: ${nativeCache.error ?? "?"}`
              : "not checked"}
          </dd>
          <dt>hasFailedNativePreview</dt>
          <dd>{sourcePath && hasFailedNativePreview(sourcePath) ? "yes" : "no"}</dd>
          {selectedFootageItem?.mediaInfo?.pixelFormat && (
            <>
              <dt>Pixel format</dt>
              <dd>{selectedFootageItem.mediaInfo.pixelFormat}</dd>
            </>
          )}
          {selectedFootageItem?.mediaInfo?.videoCodec && (
            <>
              <dt>Video codec</dt>
              <dd>{selectedFootageItem.mediaInfo.videoCodec}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="debug-diagnostics-section">
        <h4>Playback</h4>
        <dl className="debug-diagnostics-dl">
          <dt>Mode</dt>
          <dd>{playback.syncMode}</dd>
          <dt>Cache playback</dt>
          <dd>{playback.useCachePlayback ? "yes" : "no"}</dd>
          <dt>Playing</dt>
          <dd>{playback.isPlaying ? "yes" : "no"}</dd>
          <dt>compCurrentTime</dt>
          <dd>{playback.compCurrentTime.toFixed(3)}s</dd>
          <dt>video.currentTime</dt>
          <dd>
            {playback.videoCurrentTime !== null
              ? `${playback.videoCurrentTime.toFixed(3)}s`
              : "—"}
          </dd>
          <dt>Drift (video − expected)</dt>
          <dd>
            {playback.driftSeconds !== null
              ? `${playback.driftSeconds.toFixed(3)}s`
              : "—"}
          </dd>
          <dt>playbackRate</dt>
          <dd>{playback.playbackRate}×</dd>
          <dt>Master layer</dt>
          <dd>{playback.masterLayerId ?? "—"}</dd>
          <dt>Audible layer</dt>
          <dd>{playback.audibleLayerId ?? "—"}</dd>
        </dl>
      </div>

      <div className="debug-diagnostics-section">
        <h4>Timeline</h4>
        <dl className="debug-diagnostics-dl">
          <dt>View mode</dt>
          <dd>{timelineViewMode}</dd>
          <dt>Active tool</dt>
          <dd>{activeTool}</dd>
          <dt>Selected layer</dt>
          <dd>{selectedLayer?.name ?? "—"}</dd>
          <dt>Reveal mode</dt>
          <dd>{timelineRevealState.mode}</dd>
          {timelineRevealState.mode !== "normal" && (
            <>
              <dt>Reveal layer</dt>
              <dd>{timelineRevealState.layerId ?? "—"}</dd>
              <dt>Reveal properties</dt>
              <dd>{timelineRevealState.properties.join(", ") || "—"}</dd>
            </>
          )}
          <dt>Visible property rows</dt>
          <dd>
            {visibleRows.length > 0
              ? visibleRows.map(propertyRowLabel).join(", ")
              : "—"}
          </dd>
          <dt>Playhead (prop)</dt>
          <dd>{compCurrentTime.toFixed(3)}s</dd>
        </dl>
      </div>

      <div className="debug-diagnostics-section">
        <h4>Render</h4>
        <dl className="debug-diagnostics-dl">
          <dt>Render range</dt>
          <dd>{renderRange}</dd>
          <dt>Resolved range</dt>
          <dd>
            {resolvedRenderRange.start.toFixed(2)}s –{" "}
            {resolvedRenderRange.end.toFixed(2)}s
          </dd>
          <dt>Video layers (enabled)</dt>
          <dd>{videoLayers}</dd>
          <dt>Audio layers (enabled, unmuted)</dt>
          <dd>{audioLayers}</dd>
        </dl>
      </div>

      {!selectedFootageItem && !selectedLayer && (
        <p className="debug-diagnostics-empty">Select a layer or footage for media details.</p>
      )}
        </>
      )}
    </section>
  );
}
