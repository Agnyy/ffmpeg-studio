import { DragEvent } from "react";
import { getBasename } from "../../shared/pathUtils";
import { getPresetById } from "../../presets";
import type { Job, MediaInfo } from "../../shared/types";
import {
  formatBitrate,
  formatDuration,
  formatFps,
  formatResolution,
} from "../utils/format";

type CenterWorkspaceProps = {
  selectedJob: Job | null;
  mediaInfo?: MediaInfo;
  onAddMedia: () => void;
  onFilesAdded: (paths: string[]) => void;
};

export default function CenterWorkspace({
  selectedJob,
  mediaInfo,
  onAddMedia,
  onFilesAdded,
}: CenterWorkspaceProps) {
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");
    const paths = Array.from(event.dataTransfer.files)
      .map((f) => f.path)
      .filter(Boolean);
    if (paths.length > 0) {
      onFilesAdded(paths);
    }
  };

  const dragHandlers = {
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.classList.add("drag-over");
    },
    onDragLeave: (e: DragEvent<HTMLDivElement>) => {
      e.currentTarget.classList.remove("drag-over");
    },
    onDrop: handleDrop,
  };

  const preset =
    selectedJob?.presetId ? getPresetById(selectedJob.presetId) : undefined;

  return (
    <section className="workspace">
      <div className="workspace-header">
        <h2 className="workspace-header-title">Preview / Workspace</h2>
      </div>

      <div className="workspace-body">
        {!selectedJob ? (
          <div className="workspace-empty" {...dragHandlers}>
            <div className="workspace-empty-icon">▶</div>
            <p className="workspace-empty-text">Add a video file to start</p>
            <p className="workspace-empty-hint">Drag and drop or use Add Media</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={onAddMedia}>
              Add Media
            </button>
          </div>
        ) : (
          <div className="workspace-preview">
            <div className="preview-stage" {...dragHandlers}>
              <div className="preview-placeholder-icon">▶</div>
              <div className="preview-filename">{getBasename(selectedJob.inputPath)}</div>
            </div>

            <div className="preview-meta-grid">
              <div className="preview-meta-item">
                <div className="preview-meta-label">Duration</div>
                <div className="preview-meta-value">
                  {formatDuration(mediaInfo?.durationSeconds ?? selectedJob.durationSeconds)}
                </div>
              </div>
              <div className="preview-meta-item">
                <div className="preview-meta-label">Resolution</div>
                <div className="preview-meta-value">
                  {formatResolution(mediaInfo?.width, mediaInfo?.height)}
                </div>
              </div>
              <div className="preview-meta-item">
                <div className="preview-meta-label">Video Codec</div>
                <div className="preview-meta-value">{mediaInfo?.videoCodec ?? "—"}</div>
              </div>
              <div className="preview-meta-item">
                <div className="preview-meta-label">Audio Codec</div>
                <div className="preview-meta-value">{mediaInfo?.audioCodec ?? "—"}</div>
              </div>
              <div className="preview-meta-item">
                <div className="preview-meta-label">Bitrate</div>
                <div className="preview-meta-value">{formatBitrate(mediaInfo?.bitrate)}</div>
              </div>
              <div className="preview-meta-item">
                <div className="preview-meta-label">Frame Rate</div>
                <div className="preview-meta-value">{formatFps(mediaInfo?.fps)}</div>
              </div>
              <div className="preview-meta-item">
                <div className="preview-meta-label">Preset</div>
                <div className="preview-meta-value">{preset?.title ?? selectedJob.presetId}</div>
              </div>
              <div className="preview-meta-item">
                <div className="preview-meta-label">Output File</div>
                <div className="preview-meta-value" title={selectedJob.outputPath}>
                  {getBasename(selectedJob.outputPath)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
