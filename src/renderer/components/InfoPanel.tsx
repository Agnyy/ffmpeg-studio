import type { CompositionRenderRange } from "../../ffmpeg/compositionRenderBuilder";
import type { RenderRange } from "../../shared/projectDocument";
import type { ProjectItem, TimelineLayer } from "../../shared/project";
import { mediaStatusLabel } from "../../media/thumbnailStatus";
import type { MediaInfo } from "../../shared/types";
import type { EditorTool } from "../../tools/toolTypes";
import { formatDuration, formatResolution } from "../utils/format";
import { layerDuration } from "../../shared/project";
import type { PlaybackDiagnostics } from "../types/playbackDiagnostics";
import type { TimelineRevealState } from "../utils/timelinePropertyReveal";
import type { TimelineViewMode } from "../utils/timelineZoom";
import DebugDiagnosticsPanel from "./DebugDiagnosticsPanel";
import PerformancePanel from "./PerformancePanel";
import type { Job } from "../../shared/types";

type InfoPanelProps = {
  selectedLayer: TimelineLayer | null;
  selectedFootageItem: ProjectItem | null;
  selectedProjectItem: ProjectItem | null;
  mediaInfo?: MediaInfo;
  proxyGeneratingIds?: Set<string>;
  onCreatePreviewProxy?: (itemId: string) => void;
  timelineLayers?: TimelineLayer[];
  timelineRevealState?: TimelineRevealState;
  timelineViewMode?: TimelineViewMode;
  activeTool?: EditorTool;
  compWidth?: number;
  compHeight?: number;
  compCurrentTime?: number;
  playbackDiagnostics?: PlaybackDiagnostics;
  renderRange?: RenderRange;
  resolvedRenderRange?: CompositionRenderRange;
  previewPathBySourcePath?: Record<string, string>;
  jobs?: Job[];
  isPlaying?: boolean;
};

export default function InfoPanel({
  selectedLayer,
  selectedFootageItem,
  selectedProjectItem,
  mediaInfo,
  proxyGeneratingIds: _proxyGeneratingIds,
  onCreatePreviewProxy: _onCreatePreviewProxy,
  timelineLayers = [],
  timelineRevealState,
  timelineViewMode = "layer",
  activeTool = "selection",
  compWidth = 1920,
  compHeight = 1080,
  compCurrentTime = 0,
  playbackDiagnostics,
  renderRange = "full",
  resolvedRenderRange = { mode: "full", start: 0, end: 0 },
  previewPathBySourcePath = {},
  jobs = [],
  isPlaying = false,
}: InfoPanelProps) {
  const footage = selectedFootageItem ?? (
    selectedProjectItem?.type === "footage" ? selectedProjectItem : null
  );

  if (!selectedLayer && !footage) {
    return (
      <div className="info-panel">
        <p className="info-panel-empty">No item selected</p>
        <p className="info-panel-hint">
          Select a layer in the timeline or footage in the Project panel.
        </p>
        <PerformancePanel
          jobs={jobs}
          timelineLayerCount={timelineLayers.length}
          isPlaying={isPlaying}
        />
      </div>
    );
  }

  return (
    <div className="info-panel">
      {selectedLayer && (
        <section className="info-panel-section">
          <h3 className="info-panel-title">Layer</h3>
          <dl className="info-panel-meta">
            <div>
              <dt>Name</dt>
              <dd>{selectedLayer.name}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{selectedLayer.sourcePath}</dd>
            </div>
            <div>
              <dt>Start</dt>
              <dd>{selectedLayer.startTime.toFixed(2)}s</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{layerDuration(selectedLayer).toFixed(2)}s</dd>
            </div>
            <div>
              <dt>Enabled</dt>
              <dd>{selectedLayer.enabled ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Locked</dt>
              <dd>{selectedLayer.locked ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Muted</dt>
              <dd>{selectedLayer.muted ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </section>
      )}

      {footage && (
        <section className="info-panel-section">
          <h3 className="info-panel-title">Footage</h3>
          <dl className="info-panel-meta">
            <div>
              <dt>Path</dt>
              <dd>{footage.originalPath ?? footage.path}</dd>
            </div>
            {footage.mediaInfo && (
              <>
                <div>
                  <dt>Duration</dt>
                  <dd>{formatDuration(footage.mediaInfo.durationSeconds)}</dd>
                </div>
                <div>
                  <dt>Resolution</dt>
                  <dd>
                    {formatResolution(
                      footage.mediaInfo.width,
                      footage.mediaInfo.height
                    )}
                  </dd>
                </div>
                {footage.mediaInfo.videoCodec && (
                  <div>
                    <dt>Codec</dt>
                    <dd>{footage.mediaInfo.videoCodec}</dd>
                  </div>
                )}
              </>
            )}
            <div>
              <dt>Media</dt>
              <dd>{mediaStatusLabel(footage)}</dd>
            </div>
          </dl>
        </section>
      )}

      {selectedLayer && mediaInfo && (
        <section className="info-panel-section">
          <h3 className="info-panel-title">Source Media</h3>
          <dl className="info-panel-meta">
            <div>
              <dt>Resolution</dt>
              <dd>{formatResolution(mediaInfo.width, mediaInfo.height)}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{formatDuration(mediaInfo.durationSeconds)}</dd>
            </div>
          </dl>
        </section>
      )}

      <PerformancePanel
        jobs={jobs}
        timelineLayerCount={timelineLayers.length}
        isPlaying={isPlaying}
      />

      {playbackDiagnostics && timelineRevealState && (
        <DebugDiagnosticsPanel
          selectedLayer={selectedLayer}
          selectedFootageItem={selectedFootageItem}
          timelineLayers={timelineLayers}
          timelineRevealState={timelineRevealState}
          timelineViewMode={timelineViewMode}
          activeTool={activeTool}
          compWidth={compWidth}
          compHeight={compHeight}
          compCurrentTime={compCurrentTime}
          playback={playbackDiagnostics}
          renderRange={renderRange}
          resolvedRenderRange={resolvedRenderRange}
          previewPathBySourcePath={previewPathBySourcePath}
          jobs={jobs}
        />
      )}
    </div>
  );
}
