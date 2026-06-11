import type { ProjectItem } from "../shared/project";
import { getChromiumVideoSrc } from "./mediaCompatibility";
import { logChromiumQuarantine } from "./chromiumQuarantine";
import { isSessionBlockedChromiumOriginal } from "./chromiumSessionBlocklist";
import { isNativePreviewCheckInProgress } from "./nativePreviewCache";

export type VideoCreateOwner =
  | "CompositionPreviewLayer"
  | "PreviewCacheVideo"
  | "thumbnailGenerator"
  | "nativePreviewTest"
  | "thumbnail"
  | "TimelineThumbnails"
  | "waveform"
  | "hiddenPreload";

export function pathsReferToSameFile(a: string, b: string): boolean {
  const normalize = (path: string) => path.trim().replace(/\//g, "\\");
  return normalize(a) === normalize(b);
}

/**
 * Single gate for assigning Chromium &lt;video&gt; src from a ProjectItem.
 */
export function assignChromiumVideoSource(
  video: HTMLVideoElement,
  owner: VideoCreateOwner,
  item: ProjectItem
): boolean {
  const srcPath = getChromiumVideoSrc(item);
  if (!srcPath) {
    if (owner !== "nativePreviewTest") {
      logChromiumQuarantine(item.name);
    }
    return false;
  }

  if (
    owner !== "nativePreviewTest" &&
    isNativePreviewCheckInProgress(item.originalPath ?? item.path ?? "")
  ) {
    logChromiumQuarantine(item.name);
    return false;
  }

  video.src = window.ffmpegStudio.toFileUrl(srcPath);
  return true;
}

/** One-shot import probe only; blocked if session quarantine is active. */
export function assignNativePreviewTestSource(
  video: HTMLVideoElement,
  fileUrl: string,
  originalPath?: string
): boolean {
  if (originalPath && isSessionBlockedChromiumOriginal(originalPath)) {
    return false;
  }
  video.src = fileUrl;
  return true;
}
