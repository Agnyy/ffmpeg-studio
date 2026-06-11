import {
  FfmpegWarningDeduper,
  matchingBenignFfmpegWarning,
  shouldSuppressFfmpegStderrLine,
} from "../shared/ffmpegLogFilter";

let stderrFilterInstalled = false;

function filterStderrChunk(
  chunk: string | Uint8Array,
  encoding: BufferEncoding | undefined,
  deduper: FfmpegWarningDeduper,
  isProduction: boolean
): string | Uint8Array | null {
  const text =
    typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(encoding ?? "utf8");

  if (!shouldSuppressFfmpegStderrLine(text)) {
    return chunk;
  }

  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    if (!line) {
      continue;
    }
    const benign = matchingBenignFfmpegWarning(line);
    if (benign) {
      deduper.noteSuppressed(benign, isProduction);
      continue;
    }
    kept.push(line);
  }

  if (kept.length === 0) {
    return null;
  }
  const filtered = kept.join("\n");
  return typeof chunk === "string" ? filtered : Buffer.from(filtered, encoding ?? "utf8");
}

/**
 * Narrow stderr filter for FFmpeg noise that still reaches process.stderr.
 * Real errors (Assertion, decode failures, etc.) are never matched or suppressed.
 */
export function installMainProcessFfmpegStderrFilter(isProduction: boolean): void {
  if (stderrFilterInstalled) {
    return;
  }
  stderrFilterInstalled = true;

  const deduper = new FfmpegWarningDeduper();
  const stderr = process.stderr as NodeJS.WriteStream & {
    write: (
      chunk: string | Uint8Array,
      encoding?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void
    ) => boolean;
  };
  const originalWrite = stderr.write.bind(stderr);

  stderr.write = (
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void
  ): boolean => {
    const encodingArg = typeof encoding === "string" ? encoding : undefined;
    const callbackArg = typeof encoding === "function" ? encoding : callback;

    const filtered = filterStderrChunk(chunk, encodingArg, deduper, isProduction);
    if (filtered === null) {
      if (callbackArg) {
        callbackArg();
      }
      return true;
    }

    if (encodingArg) {
      return originalWrite(filtered, encodingArg, callbackArg);
    }
    return originalWrite(filtered, callbackArg);
  };
}
