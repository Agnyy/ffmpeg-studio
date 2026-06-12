import type { FfmpegResolveResult } from "../../shared/types";
import type { SaveStatus } from "../hooks/useProjectDocument";

type TopBarProps = {
  ffmpegStatus: FfmpegResolveResult | null;
  isRunning: boolean;
  canStart: boolean;
  projectName: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  onAddMedia: () => void;
  onStartQueue: () => void;
  onOpenSettings: () => void;
  renderLabel?: string;
  taskSummary?: string;
  canCancelTask?: boolean;
  onCancelTask?: () => void;
  statusMessage?: string | null;
};

export default function TopBar({
  ffmpegStatus,
  isRunning,
  canStart,
  onAddMedia,
  onStartQueue,
  onOpenSettings,
  projectName,
  isDirty,
  saveStatus,
  renderLabel = "Start Queue",
  taskSummary = "Idle",
  canCancelTask = false,
  onCancelTask,
  statusMessage,
}: TopBarProps) {
  const saveLabel =
    saveStatus === "autosaved"
      ? "Autosaved"
      : isDirty
        ? "Unsaved changes"
        : "Saved";
  const ffmpegOk = ffmpegStatus?.ok ?? false;
  const statusText = !ffmpegStatus
    ? "Checking…"
    : ffmpegOk
      ? "Found"
      : ffmpegStatus.error
        ? "Error"
        : "Missing";

  return (
    <header className="top-bar">
      <div className="top-bar-brand">
        <h1 className="top-bar-title">FFmpeg Studio</h1>
        <p className="top-bar-subtitle">
          {projectName}
          {isDirty ? " *" : ""}
          <span className="top-bar-save-status"> · {saveLabel}</span>
        </p>
      </div>

      <div className="top-bar-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAddMedia}>
          Add Media
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onStartQueue}
          disabled={!canStart || isRunning}
          title="Render current composition"
        >
          {isRunning ? "Processing…" : renderLabel}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!canCancelTask}
          onClick={onCancelTask}
          title={canCancelTask ? "Cancel running task" : "No running task"}
        >
          Stop
        </button>

        <div className="top-bar-status">
          <span className="top-bar-task-summary">{taskSummary}</span>
          <span
            className={`status-dot ${!ffmpegStatus ? "pending" : ffmpegOk ? "ok" : "error"}`}
          />
          <span>FFmpeg: {statusText}</span>
        </div>

        <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
          Settings
        </button>
      </div>

      {statusMessage && (
        <div className="top-bar-status-toast" role="status">
          {statusMessage}
        </div>
      )}
    </header>
  );
}
