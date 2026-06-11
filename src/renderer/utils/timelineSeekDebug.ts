const importMetaEnv = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;

export const LOG_TIMELINE_SEEK_DEBUG = importMetaEnv?.DEV === true;

export function logTimelineClick(time: number): void {
  if (!LOG_TIMELINE_SEEK_DEBUG) {
    return;
  }
  console.log(`[TIMELINE_CLICK] time=${time.toFixed(3)}`);
}

export function logAppSeek(time: number): void {
  if (!LOG_TIMELINE_SEEK_DEBUG) {
    return;
  }
  console.log(`[APP_SEEK] time=${time.toFixed(3)}`);
}

export function logPreviewProps(seekTime: number | null, compCurrentTime: number): void {
  if (!LOG_TIMELINE_SEEK_DEBUG) {
    return;
  }
  console.log(
    `[PREVIEW_PROPS] seekTime=${seekTime === null ? "null" : seekTime.toFixed(3)} compCurrentTime=${compCurrentTime.toFixed(3)}`
  );
}

export function logEngineSeekProp(seekTime: number, sessionReady: boolean): void {
  if (!LOG_TIMELINE_SEEK_DEBUG) {
    return;
  }
  console.log(
    `[ENGINE_SEEK_PROP] seekTime=${seekTime.toFixed(3)} sessionReady=${sessionReady ? "yes" : "no"}`
  );
}
