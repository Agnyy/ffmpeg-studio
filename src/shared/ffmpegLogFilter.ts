/** Known benign FFmpeg warnings (exact substring match). */
export const BENIGN_FFMPEG_WARNING_SUBSTRINGS = [
  "UDTA parsing failed retrying raw",
] as const;

/** Never suppress output containing these substrings. */
export const FATAL_FFMPEG_SUBSTRINGS = [
  "Assertion",
  "failed at",
  "Invalid data",
  "decode error",
  "No frame",
] as const;

export function isFatalFfmpegOutput(text: string): boolean {
  return FATAL_FFMPEG_SUBSTRINGS.some((pattern) => text.includes(pattern));
}

export function matchingBenignFfmpegWarning(text: string): string | null {
  if (isFatalFfmpegOutput(text)) {
    return null;
  }
  for (const pattern of BENIGN_FFMPEG_WARNING_SUBSTRINGS) {
    if (text.includes(pattern)) {
      return pattern;
    }
  }
  return null;
}

export function shouldSuppressFfmpegStderrLine(text: string): boolean {
  return matchingBenignFfmpegWarning(text) !== null;
}

export class FfmpegWarningDeduper {
  private readonly seen = new Set<string>();

  /**
   * @returns true if the line should be suppressed from stderr output
   */
  noteSuppressed(pattern: string, isProduction: boolean): boolean {
    if (isProduction) {
      return true;
    }
    if (this.seen.has(pattern)) {
      return true;
    }
    this.seen.add(pattern);
    console.warn(`[FFMPEG_WARNING_SUPPRESSED] ${pattern}`);
    return true;
  }
}

let nodeAvLoggingConfigured = false;

/**
 * Hide FFmpeg warning/info via node-av Log API (av_log_set_level).
 * Errors and fatals still pass through.
 */
export async function configureNodeAvFfmpegLogging(): Promise<void> {
  if (nodeAvLoggingConfigured) {
    return;
  }
  nodeAvLoggingConfigured = true;

  const { Log } = await import("node-av/lib");
  const { AV_LOG_ERROR } = await import("node-av/constants");
  Log.setLevel(AV_LOG_ERROR);
}

export function isEnginePreviewDevDiagEnabled(): boolean {
  return (
    process.env.ENGINE_PREVIEW_DEV_DIAG === "1" ||
    process.env.VITE_ENGINE_PREVIEW_DEV_DIAG === "1"
  );
}
