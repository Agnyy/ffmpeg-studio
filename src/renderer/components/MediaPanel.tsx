import { DragEvent } from "react";
import { getBasename } from "../../shared/pathUtils";
import type { MediaInfo } from "../../shared/types";
import { formatDuration, formatResolution } from "../utils/format";

export type MediaEntry = {
  inputPath: string;
  mediaInfo?: MediaInfo;
  probeError?: string;
};

type MediaPanelProps = {
  entries: MediaEntry[];
  selectedInputPath: string | null;
  onSelect: (inputPath: string) => void;
  onFilesAdded: (paths: string[]) => void;
};

function getMediaStatus(entry: MediaEntry): {
  label: string;
  className: string;
} {
  if (entry.probeError) {
    return { label: "Error", className: "error" };
  }
  if (entry.mediaInfo) {
    return { label: "Ready", className: "ready" };
  }
  return { label: "Missing info", className: "missing" };
}

export default function MediaPanel({
  entries,
  selectedInputPath,
  onSelect,
  onFilesAdded,
}: MediaPanelProps) {
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

  if (entries.length === 0) {
    return (
      <div className="panel-section">
        <p className="panel-section-title">Media</p>
        <div
          className="media-drop-mini"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("drag-over");
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove("drag-over")}
          onDrop={handleDrop}
        >
          Drop video files here
        </div>
        <p className="empty-sidebar" style={{ paddingTop: 8 }}>
          No media loaded
        </p>
      </div>
    );
  }

  return (
    <div className="panel-section">
      <p className="panel-section-title">Media ({entries.length})</p>
      <div className="media-list">
        {entries.map((entry) => {
          const status = getMediaStatus(entry);
          const isSelected = entry.inputPath === selectedInputPath;

          return (
            <button
              key={entry.inputPath}
              type="button"
              className={`media-item ${isSelected ? "selected" : ""}`}
              onClick={() => onSelect(entry.inputPath)}
            >
              <div className="media-item-icon">▶</div>
              <div className="media-item-body">
                <div className="media-item-name">{getBasename(entry.inputPath)}</div>
                <div className="media-item-meta">
                  {formatDuration(entry.mediaInfo?.durationSeconds)} ·{" "}
                  {formatResolution(entry.mediaInfo?.width, entry.mediaInfo?.height)}
                </div>
                <div className={`media-item-status ${status.className}`}>
                  {status.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div
        className="media-drop-mini"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("drag-over");
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove("drag-over")}
        onDrop={handleDrop}
      >
        + Drop more files
      </div>
    </div>
  );
}
