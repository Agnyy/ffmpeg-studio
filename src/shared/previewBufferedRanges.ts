/** Source-time ranges decoded by the preview engine (not proxy / render cache). */
export type PreviewBufferedRange = {
  start: number;
  end: number;
};

export type PreviewBufferState = {
  previewBufferedRanges: PreviewBufferedRange[];
  /** Active decode/buffer window while seeking or priming playback. */
  bufferingRange: PreviewBufferedRange | null;
};

export const EMPTY_PREVIEW_BUFFER_STATE: PreviewBufferState = {
  previewBufferedRanges: [],
  bufferingRange: null,
};

export function hasSeparatedPreviewBufferRanges(
  ranges: PreviewBufferedRange[],
  minGapSec = 1
): boolean {
  if (ranges.length < 2) {
    return false;
  }
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].start - sorted[index - 1].end >= minGapSec) {
      return true;
    }
  }
  return false;
}

export function formatPreviewBufferedRangesSample(
  ranges: PreviewBufferedRange[]
): string {
  if (ranges.length === 0) {
    return "[]";
  }
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  return sorted
    .map((range) => `${range.start.toFixed(1)}-${range.end.toFixed(1)}`)
    .join(", ");
}
