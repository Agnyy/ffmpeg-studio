export type ThumbnailDebugPipeResult = {
  dataUrl: string | null;
  byteLength: number;
  head: string;
  error: string | null;
};

export function extractThumbnailDataUrl(value: unknown): string | null {
  const dataUrl =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "dataUrl" in value
        ? (value as { dataUrl?: unknown }).dataUrl
        : null;

  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return null;
  }

  return dataUrl;
}

/** Same IPC path used by Thumb Debug — for Project Panel thumbnails. */
export async function fetchProjectItemThumbnailDataUrl(
  inputPath: string
): Promise<string | null> {
  const result = await runThumbnailDebugPipe(inputPath);
  return result.dataUrl;
}

export async function runThumbnailDebugPipe(
  inputPath: string
): Promise<ThumbnailDebugPipeResult> {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    return {
      dataUrl: null,
      byteLength: 0,
      head: "",
      error: "No input path",
    };
  }

  try {
    const result = await window.ffmpegStudio.thumbnailDebugPipe(trimmed);
    const dataUrl = extractThumbnailDataUrl(result);
    const byteLength =
      result && typeof result === "object" && "byteLength" in result
        ? Number((result as { byteLength?: unknown }).byteLength) || 0
        : 0;

    if (!dataUrl) {
      return {
        dataUrl: null,
        byteLength,
        head: summarizeValue(result),
        error: "Invalid thumbnail dataUrl from IPC",
      };
    }

    return {
      dataUrl,
      byteLength: byteLength || estimateDataUrlBytes(dataUrl),
      head: dataUrl.slice(0, 80),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      dataUrl: null,
      byteLength: 0,
      head: "",
      error: message,
    };
  }
}

function summarizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === "string") {
    return value.slice(0, 80);
  }
  try {
    return JSON.stringify(value).slice(0, 120);
  } catch {
    return String(value).slice(0, 80);
  }
}

function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) {
    return 0;
  }
  const base64 = dataUrl.slice(comma + 1);
  return Math.floor((base64.length * 3) / 4);
}
