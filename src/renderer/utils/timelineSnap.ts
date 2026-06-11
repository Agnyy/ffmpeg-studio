export function snapTime(
  time: number,
  targets: number[],
  toleranceSeconds: number
): number {
  let snapped = time;
  let closestDist = toleranceSeconds;

  for (const target of targets) {
    const dist = Math.abs(target - time);
    if (dist <= closestDist) {
      closestDist = dist;
      snapped = target;
    }
  }

  return snapped;
}

export function pixelsToToleranceSeconds(
  pixels: number,
  trackWidthPx: number,
  compDuration: number
): number {
  if (trackWidthPx <= 0 || compDuration <= 0) {
    return 0.1;
  }
  return (pixels / trackWidthPx) * compDuration;
}
