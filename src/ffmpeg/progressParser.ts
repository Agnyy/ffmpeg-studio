const TIME_REGEX = /time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/;

export function parseTimeToSeconds(time: string): number {
  const match = time.match(TIME_REGEX);
  if (!match) {
    return 0;
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseFloat(match[3]);

  return hours * 3600 + minutes * 60 + seconds;
}

export function parseProgressFromLine(
  line: string,
  durationSeconds?: number
): { progress: number; indeterminate: boolean } | null {
  const match = line.match(TIME_REGEX);
  if (!match) {
    return null;
  }

  if (!durationSeconds || durationSeconds <= 0) {
    return { progress: 0, indeterminate: true };
  }

  const currentSeconds = parseTimeToSeconds(line);
  const progress = Math.min(100, (currentSeconds / durationSeconds) * 100);

  return { progress, indeterminate: false };
}
