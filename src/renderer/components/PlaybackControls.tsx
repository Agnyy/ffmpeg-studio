import type { PreviewCacheStatus } from "../../shared/previewCache";
import type { PreviewSyncMode } from "../utils/previewPlayback";
import { formatTimecode } from "../utils/time";

type PlaybackControlsProps = {
  disabled?: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  loop: boolean;
  previewSyncMode?: PreviewSyncMode;
  cacheStatus?: PreviewCacheStatus;
  cachePreviewBusy?: boolean;
  onTogglePlay: () => void;
  onGoToStart: () => void;
  onGoToEnd: () => void;
  onPrevFrame: () => void;
  onNextFrame: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onToggleLoop: () => void;
  onCachePreview?: () => void;
  onClearPreviewCache?: () => void;
};

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

export default function PlaybackControls({
  disabled = false,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  loop,
  previewSyncMode = "composition-clock",
  cacheStatus = "none",
  cachePreviewBusy = false,
  onTogglePlay,
  onGoToStart,
  onGoToEnd,
  onPrevFrame,
  onNextFrame,
  onPlaybackRateChange,
  onToggleLoop,
  onCachePreview,
  onClearPreviewCache,
}: PlaybackControlsProps) {
  return (
    <div className="playback-controls">
      <div className="playback-controls-buttons">
        <button
          type="button"
          className="playback-btn"
          onClick={onGoToStart}
          disabled={disabled}
          title="Go to start (Home)"
        >
          |◀
        </button>
        <button
          type="button"
          className="playback-btn"
          onClick={onPrevFrame}
          disabled={disabled}
          title="Previous frame (←)"
        >
          ◀|
        </button>
        <button
          type="button"
          className="playback-btn playback-btn-play"
          data-testid="preview-play-button"
          onClick={onTogglePlay}
          disabled={disabled}
          title="Play / Pause (Space)"
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>
        <button
          type="button"
          className="playback-btn"
          onClick={onNextFrame}
          disabled={disabled}
          title="Next frame (→)"
        >
          |▶
        </button>
        <button
          type="button"
          className="playback-btn"
          onClick={onGoToEnd}
          disabled={disabled}
          title="Go to end (End)"
        >
          ▶|
        </button>
        <button
          type="button"
          className={`playback-btn playback-btn-loop ${loop ? "active" : ""}`}
          onClick={onToggleLoop}
          disabled={disabled}
          title="Loop"
        >
          ↻
        </button>
      </div>

      <div className="playback-controls-readout">
        <span className="playback-timecode">
          {formatTimecode(currentTime)} / {formatTimecode(duration)}
        </span>
      </div>

      <div className="playback-controls-speed">
        <label className="playback-speed-label" htmlFor="playback-speed">
          Speed
        </label>
        <select
          id="playback-speed"
          className="playback-speed-select"
          value={playbackRate}
          disabled={disabled}
          onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
        >
          {SPEED_OPTIONS.map((rate) => (
            <option key={rate} value={rate}>
              {rate}x
            </option>
          ))}
        </select>
      </div>

      <div className="playback-controls-cache">
        <span className="playback-sync-badge" title="Preview sync mode">
          {previewSyncMode === "video-master"
            ? "Video sync"
            : previewSyncMode === "cache-master"
              ? "Cache sync"
              : "Comp sync"}
        </span>
        {onCachePreview && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={disabled || cachePreviewBusy}
            onClick={onCachePreview}
          >
            {cachePreviewBusy || cacheStatus === "caching" ? "Caching…" : "Cache Preview"}
          </button>
        )}
        {onClearPreviewCache && cacheStatus !== "none" && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={disabled || cachePreviewBusy}
            onClick={onClearPreviewCache}
          >
            Clear Cache
          </button>
        )}
      </div>
    </div>
  );
}
