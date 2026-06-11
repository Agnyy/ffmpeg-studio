import { blockChromiumOriginalPath } from "./chromiumSessionBlocklist";

export type NativePreviewCacheEntry = {
  ok: boolean;
  error?: string;
  checkedAt: string;
};

const nativePreviewResultCache = new Map<string, NativePreviewCacheEntry>();

/** Canonical filesystem path for cache keys (file:// vs native path). */
export function normalizePreviewCachePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith("file://")) {
    try {
      const url = new URL(trimmed);
      let pathname = decodeURIComponent(url.pathname);
      if (/^\/[a-zA-Z]:/.test(pathname)) {
        pathname = pathname.slice(1);
      }
      return pathname.replace(/\//g, "\\");
    } catch {
      return trimmed;
    }
  }

  return trimmed.replace(/\//g, "\\");
}

function cacheKey(path: string): string {
  return normalizePreviewCachePath(path);
}

export function getCachedNativePreviewResult(
  path: string
): NativePreviewCacheEntry | undefined {
  return nativePreviewResultCache.get(cacheKey(path));
}

export function setCachedNativePreviewResult(
  path: string,
  result: { ok: boolean; error?: string }
): void {
  const key = cacheKey(path);
  nativePreviewResultCache.set(key, {
    ...result,
    checkedAt: new Date().toISOString(),
  });
}

export function clearNativePreviewCacheForPath(path: string): void {
  nativePreviewResultCache.delete(cacheKey(path));
}

export function hasFailedNativePreview(path: string): boolean {
  const entry = nativePreviewResultCache.get(cacheKey(path));
  return entry !== undefined && !entry.ok;
}

export function markNativePreviewFailed(path: string, error: string): void {
  setCachedNativePreviewResult(path, { ok: false, error });
  blockChromiumOriginalPath(path);
}

const nativePreviewCheckInProgress = new Set<string>();

export function isNativePreviewCheckInProgress(path: string): boolean {
  return nativePreviewCheckInProgress.has(cacheKey(path));
}

export function beginNativePreviewCheck(path: string): void {
  nativePreviewCheckInProgress.add(cacheKey(path));
}

export function endNativePreviewCheck(path: string): void {
  nativePreviewCheckInProgress.delete(cacheKey(path));
}

export function isNativePreviewBlocked(path: string): boolean {
  return hasFailedNativePreview(path) || isNativePreviewCheckInProgress(path);
}
