/** ~12 updates/sec — enough for timecode/playhead without re-rendering the full app every frame. */
export const PLAYBACK_TIME_NOTIFY_MS = 80;

export function shouldThrottlePlaybackNotify(
  lastNotifyMs: number,
  now: number,
  isPlaying: boolean,
  force: boolean
): boolean {
  if (force || !isPlaying) {
    return false;
  }
  return now - lastNotifyMs < PLAYBACK_TIME_NOTIFY_MS;
}
