import type { PreviewCacheState } from "../../shared/previewCache";
import { timeToX } from "../utils/timelineZoom";

type TimelinePreviewCacheBarProps = {
  duration: number;
  timelineZoom: number;
  cache: PreviewCacheState;
};

export default function TimelinePreviewCacheBar({
  duration,
  timelineZoom,
  cache,
}: TimelinePreviewCacheBarProps) {
  if (duration <= 0) {
    return null;
  }

  const left = timeToX(cache.startTime, timelineZoom);
  const width = Math.max(
    timeToX(Math.max(0, cache.endTime - cache.startTime), timelineZoom),
    2
  );

  let statusClass = "preview-cache-gray";
  if (cache.status === "valid") {
    statusClass = "preview-cache-green";
  } else if (cache.status === "caching") {
    statusClass = "preview-cache-orange";
  } else if (cache.status === "failed") {
    statusClass = "preview-cache-red";
  }

  return (
    <div className="timeline-preview-cache-bar">
      <div
        className={`timeline-preview-cache-segment ${statusClass}`}
        style={{ left, width }}
        title={
          cache.status === "valid"
            ? `Cached preview ${cache.startTime.toFixed(1)}s – ${cache.endTime.toFixed(1)}s`
            : cache.status === "caching"
              ? "Caching preview…"
              : cache.status === "failed"
                ? cache.error ?? "Cache failed"
                : "Preview not cached"
        }
      />
    </div>
  );
}
