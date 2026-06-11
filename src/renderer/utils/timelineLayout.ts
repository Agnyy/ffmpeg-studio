export const DEFAULT_TIMELINE_LEFT_WIDTH = 420;
export const MIN_TIMELINE_LEFT_WIDTH = 360;
export const MAX_TIMELINE_LEFT_WIDTH = 620;

const STORAGE_KEY = "ffmpeg-studio.timeline-left-width";

export function loadTimelineLeftWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_TIMELINE_LEFT_WIDTH;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_TIMELINE_LEFT_WIDTH;
    }
    return clampTimelineLeftWidth(parsed);
  } catch {
    return DEFAULT_TIMELINE_LEFT_WIDTH;
  }
}

export function saveTimelineLeftWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampTimelineLeftWidth(width)));
  } catch {
    // ignore quota / private mode
  }
}

export function clampTimelineLeftWidth(width: number): number {
  return Math.max(MIN_TIMELINE_LEFT_WIDTH, Math.min(MAX_TIMELINE_LEFT_WIDTH, Math.round(width)));
}
