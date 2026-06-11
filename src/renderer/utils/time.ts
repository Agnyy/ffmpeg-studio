export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00.0";
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
  }

  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function parseTimeInput(value: string, maxSeconds?: number): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((part) => parseFloat(part));
    if (parts.some((part) => Number.isNaN(part))) {
      return 0;
    }
    let seconds = 0;
    if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      seconds = parts[0] * 60 + parts[1];
    } else {
      seconds = parts[0];
    }
    return clampTime(seconds, maxSeconds);
  }

  const numeric = parseFloat(trimmed);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return clampTime(numeric, maxSeconds);
}

function clampTime(value: number, maxSeconds?: number): number {
  const min = 0;
  const max = maxSeconds ?? Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, value));
}

export function clampTrimRange(
  trimStart: number,
  trimEnd: number,
  duration: number
): { trimStart: number; trimEnd: number } {
  const minGap = 0.05;
  const maxEnd = Math.max(minGap, duration);
  let start = Math.max(0, Math.min(trimStart, maxEnd - minGap));
  let end = Math.max(start + minGap, Math.min(trimEnd, maxEnd));
  return { trimStart: start, trimEnd: end };
}

export function frameDuration(fps: number): number {
  return 1 / (fps > 0 ? fps : 30);
}

export function stepFrame(time: number, deltaFrames: number, fps: number): number {
  return Math.max(0, time + deltaFrames * frameDuration(fps));
}

export function snapTimeToFrame(time: number, fps: number): number {
  const safeFps = fps > 0 ? fps : 30;
  return Math.round(time * safeFps) / safeFps;
}
