import type { ProjectItem } from "../shared/project";
import { clearSessionChromiumBlock } from "./chromiumSessionBlocklist";
import { clearNativePreviewCacheForPath } from "./nativePreviewCache";

export const CHROMIUM_PREVIEW_BLOCKED_REASON =
  "unsupported-pixel-format-or-media-pipeline" as const;

const quarantineLogged = new Set<string>();

export function logChromiumQuarantine(filename: string): void {
  if (quarantineLogged.has(filename)) {
    return;
  }
  quarantineLogged.add(filename);
  console.log(`[CHROMIUM_QUARANTINE] blocked original video src for ${filename}`);
}

export function isChromiumPreviewAllowed(item: ProjectItem): boolean {
  if (item.type !== "footage") {
    return false;
  }
  return item.chromiumPreviewAllowed !== false;
}

export function applyChromiumQuarantine(
  _item: ProjectItem,
  reason: string = CHROMIUM_PREVIEW_BLOCKED_REASON
): Pick<
  ProjectItem,
  | "chromiumPreviewAllowed"
  | "chromiumPreviewBlockedReason"
  | "chromiumPreviewVerified"
  | "compatibilityStatus"
> {
  return {
    chromiumPreviewAllowed: false,
    chromiumPreviewBlockedReason: reason,
    chromiumPreviewVerified: false,
    compatibilityStatus: "native-preview-failed",
  };
}

export function destroyHtmlVideoElement(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.remove();
}

export function canRetryChromiumPreview(item: ProjectItem): boolean {
  return (
    item.type === "footage" &&
    !item.missing &&
    Boolean(item.originalPath ?? item.path) &&
    item.chromiumPreviewAllowed === false
  );
}

export function resetChromiumPreviewForRetry(
  item: ProjectItem
): Partial<ProjectItem> {
  const originalPath = item.originalPath ?? item.path;
  if (originalPath) {
    clearNativePreviewCacheForPath(originalPath);
    clearSessionChromiumBlock(originalPath);
  }
  return {
    chromiumPreviewAllowed: true,
    chromiumPreviewBlockedReason: undefined,
    chromiumPreviewVerified: false,
    compatibilityStatus: "checking-preview",
    compatibilityReason: undefined,
    previewAttempted: false,
    lastPreviewCheckAt: undefined,
  };
}
