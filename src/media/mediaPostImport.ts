import type { ProjectItem } from "../shared/project";
import type { PreviewBackendSetting } from "../shared/types";
import { PREVIEW_ENGINE_ENABLED } from "../shared/previewEngineConfig";
import {
  applyChromiumQuarantine,
  CHROMIUM_PREVIEW_BLOCKED_REASON,
} from "./chromiumQuarantine";
import { blockChromiumOriginalPath } from "./chromiumSessionBlocklist";
import { shouldAttemptNativePreview } from "./mediaCompatibility";
import { getNativePreviewSkipReason } from "./mediaNativePreviewHints";
import {
  beginNativePreviewCheck,
  endNativePreviewCheck,
  getCachedNativePreviewResult,
  setCachedNativePreviewResult,
} from "./nativePreviewCache";
import { testNativeVideoPreview } from "./nativePreviewTest";

export async function runNativePreviewCheck(
  item: ProjectItem,
  options?: { previewBackend?: PreviewBackendSetting }
): Promise<{ ok: boolean; error?: string }> {
  const originalPath = item.originalPath ?? item.path;
  if (!originalPath) {
    return { ok: false, error: "No preview path" };
  }

  if (PREVIEW_ENGINE_ENABLED || options?.previewBackend === "node-av") {
    return { ok: true };
  }

  const cached = getCachedNativePreviewResult(originalPath);
  if (cached) {
    return { ok: cached.ok, error: cached.error };
  }

  if (!shouldAttemptNativePreview(item, options)) {
    return {
      ok: false,
      error: item.compatibilityReason ?? "Native preview not supported for this file",
    };
  }

  const skipReason = getNativePreviewSkipReason(item.mediaInfo);
  if (skipReason) {
    const result = { ok: false as const, error: skipReason };
    setCachedNativePreviewResult(originalPath, result);
    return result;
  }

  beginNativePreviewCheck(originalPath);
  try {
    const fileUrl = window.ffmpegStudio.toFileUrl(originalPath);
    const result = await testNativeVideoPreview(fileUrl, { originalPath });
    setCachedNativePreviewResult(originalPath, result);
    return result;
  } finally {
    endNativePreviewCheck(originalPath);
  }
}

export function nodeAvImportPreviewPatch(
  item: ProjectItem
): Partial<ProjectItem> {
  return engineImportPreviewPatch(item);
}

export function engineImportPreviewPatch(item: ProjectItem): Partial<ProjectItem> {
  return {
    compatibilityStatus: "native-preview-ok",
    previewPath: item.path,
    compatibilityReason: undefined,
    previewAttempted: true,
    lastPreviewCheckAt: new Date().toISOString(),
  };
}

export function chromiumFailImportPatch(
  item: ProjectItem,
  reason: string
): Partial<ProjectItem> {
  const originalPath = item.originalPath ?? item.path;
  if (originalPath) {
    blockChromiumOriginalPath(originalPath);
  }
  return {
    ...applyChromiumQuarantine(item, CHROMIUM_PREVIEW_BLOCKED_REASON),
    compatibilityReason: reason,
    chromiumPreviewVerified: false,
    previewAttempted: true,
    lastPreviewCheckAt: new Date().toISOString(),
  };
}

export function chromiumOkImportPatch(item: ProjectItem): Partial<ProjectItem> {
  return {
    compatibilityStatus: "native-preview-ok",
    previewPath: item.path,
    chromiumPreviewAllowed: true,
    chromiumPreviewBlockedReason: undefined,
    chromiumPreviewVerified: true,
    compatibilityReason: undefined,
    previewAttempted: true,
    lastPreviewCheckAt: new Date().toISOString(),
  };
}
