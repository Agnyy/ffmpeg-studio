import { normalizePreviewCachePath } from "./nativePreviewCache";

/** Session-level: original paths that must never reach Chromium &lt;video&gt; again. */
const blockedChromiumOriginalPaths = new Set<string>();

export function blockChromiumOriginalPath(path: string): void {
  const key = normalizePreviewCachePath(path);
  if (key) {
    blockedChromiumOriginalPaths.add(key);
  }
}

export function isSessionBlockedChromiumOriginal(path: string): boolean {
  return blockedChromiumOriginalPaths.has(normalizePreviewCachePath(path));
}

export function clearSessionChromiumBlock(path: string): void {
  blockedChromiumOriginalPaths.delete(normalizePreviewCachePath(path));
}

export function getSessionBlockedChromiumOriginalPaths(): ReadonlySet<string> {
  return blockedChromiumOriginalPaths;
}
