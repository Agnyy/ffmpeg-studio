import type { PreviewBufferState } from "../../shared/previewBufferedRanges";
import { timeToX } from "../utils/timelineZoom";

type TimelinePreviewBufferBarProps = {
  duration: number;
  timelineZoom: number;
  bufferState: PreviewBufferState;
};

function segmentStyle(
  start: number,
  end: number,
  duration: number,
  timelineZoom: number
): { left: number; width: number } | null {
  if (duration <= 0 || end <= start) {
    return null;
  }
  const left = timeToX(start, timelineZoom);
  const width = Math.max(timeToX(Math.min(end, duration) - start, timelineZoom), 2);
  return { left, width };
}

export default function TimelinePreviewBufferBar({
  duration,
  timelineZoom,
  bufferState,
}: TimelinePreviewBufferBarProps) {
  if (duration <= 0) {
    return null;
  }

  const { previewBufferedRanges, bufferingRange } = bufferState;
  if (previewBufferedRanges.length === 0 && !bufferingRange) {
    return null;
  }

  return (
    <div className="timeline-preview-buffer-bar" aria-hidden>
      {previewBufferedRanges.map((range, index) => {
        const style = segmentStyle(range.start, range.end, duration, timelineZoom);
        if (!style) {
          return null;
        }
        return (
          <div
            key={`preview-buffer-${range.start}-${range.end}-${index}`}
            className="timeline-preview-buffer-segment preview-buffer-ready"
            style={style}
            title={`Preview buffered ${range.start.toFixed(1)}s – ${range.end.toFixed(1)}s`}
          />
        );
      })}
      {bufferingRange &&
        (() => {
          const style = segmentStyle(
            bufferingRange.start,
            bufferingRange.end,
            duration,
            timelineZoom
          );
          if (!style) {
            return null;
          }
          return (
            <div
              className="timeline-preview-buffer-segment preview-buffer-active"
              style={style}
              title={`Preview buffering ${bufferingRange.start.toFixed(1)}s – ${bufferingRange.end.toFixed(1)}s`}
            />
          );
        })()}
    </div>
  );
}
