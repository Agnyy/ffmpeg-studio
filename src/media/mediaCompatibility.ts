import type { MediaInfo } from "../shared/types";
import type { ProjectItem } from "../shared/project";
import {
  applyChromiumQuarantine,
  CHROMIUM_PREVIEW_BLOCKED_REASON,
  isChromiumPreviewAllowed,
  logChromiumQuarantine,
} from "./chromiumQuarantine";
import {
  blockChromiumOriginalPath,
  isSessionBlockedChromiumOriginal,
} from "./chromiumSessionBlocklist";
import {
  getCachedNativePreviewResult,
  hasFailedNativePreview,
} from "./nativePreviewCache";

export type MediaCompatibilityStatus =
  | "imported"
  | "checking-preview"
  | "native-preview-ok"
  | "native-preview-failed"
  | "proxy-generating"
  | "proxy-ready"
  | "proxy-failed"
  | "unsupported"
  | "error";

/** @deprecated Legacy persisted value — normalized to proxy-failed on load */
export type LegacyMediaCompatibilityStatus = MediaCompatibilityStatus | "proxy-needed";

export function normalizeCompatibilityStatus(
  status?: MediaCompatibilityStatus | LegacyMediaCompatibilityStatus | string
): MediaCompatibilityStatus | undefined {
  if (!status) {
    return undefined;
  }
  if (status === "proxy-needed") {
    return "proxy-failed";
  }
  return status as MediaCompatibilityStatus;
}

export type PreviewBlockReason = "checking" | "unsupported" | "generating" | "error";

export type MediaCompatibilityInfo = {
  status: MediaCompatibilityStatus;
  canProbe: boolean;
  canNativePreview?: boolean;
  needsProxy?: boolean;
  reason?: string;
  originalPath: string;
  previewPath?: string;
  proxyPath?: string;
};

const PREVIEW_UNSUPPORTED_STATUSES: MediaCompatibilityStatus[] = [
  "native-preview-failed",
  "proxy-failed",
];

export function isPreviewUnsupported(item: ProjectItem): boolean {
  if (item.type !== "footage" || !item.path) {
    return false;
  }
  const status = normalizeCompatibilityStatus(item.compatibilityStatus);
  if (
    status === "proxy-ready" &&
    item.proxyPath &&
    !hasFailedNativePreview(item.proxyPath)
  ) {
    return false;
  }
  if (status && PREVIEW_UNSUPPORTED_STATUSES.includes(status)) {
    return true;
  }
  return hasFailedNativePreview(item.originalPath ?? item.path);
}

export function isPreviewGenerating(item: ProjectItem): boolean {
  return item.compatibilityStatus === "proxy-generating";
}

export function shouldAttemptNativePreview(
  item: ProjectItem,
  options?: { previewBackend?: "chromium-video" | "node-av" }
): boolean {
  if (item.type !== "footage" || !item.path) {
    return false;
  }
  if (options?.previewBackend === "node-av") {
    return false;
  }
  if (!isChromiumPreviewAllowed(item)) {
    return false;
  }
  const status = normalizeCompatibilityStatus(item.compatibilityStatus);
  if (
    status === "native-preview-failed" ||
    status === "proxy-failed" ||
    status === "proxy-ready" ||
    status === "proxy-generating" ||
    status === "native-preview-ok" ||
    status === "unsupported" ||
    status === "error"
  ) {
    return false;
  }
  const originalPath = item.originalPath ?? item.path;
  if (hasFailedNativePreview(originalPath) || isSessionBlockedChromiumOriginal(originalPath)) {
    return false;
  }
  const cached = getCachedNativePreviewResult(originalPath);
  if (cached) {
    return false;
  }
  return status === "imported" || status === "checking-preview" || !status;
}

/** Single gate: filesystem path safe for Chromium &lt;video&gt; src, or null. */
export function getChromiumVideoSrc(item: ProjectItem): string | null {
  if (item.type !== "footage") {
    return null;
  }

  const status = normalizeCompatibilityStatus(item.compatibilityStatus);
  const originalPath = item.originalPath ?? item.path ?? null;

  if (status === "proxy-ready" && item.proxyPath) {
    return item.proxyPath;
  }

  if (status === "checking-preview" || status === "proxy-generating") {
    return null;
  }

  if (status === "native-preview-failed") {
    logChromiumQuarantine(item.name);
    return null;
  }

  if (originalPath && hasFailedNativePreview(originalPath)) {
    logChromiumQuarantine(item.name);
    return null;
  }

  if (originalPath) {
    return originalPath;
  }

  return null;
}

export function getSafePreviewPathForItem(item: ProjectItem): string | null {
  return getChromiumVideoSrc(item);
}

export function getPreviewPathForItem(item: ProjectItem): string | undefined {
  return getSafePreviewPathForItem(item) ?? undefined;
}

export function getPreviewSourceKind(
  item: ProjectItem | null | undefined
): "original" | "proxy" | "none" {
  if (!item || item.type !== "footage") {
    return "none";
  }
  const previewPath = getSafePreviewPathForItem(item);
  if (!previewPath) {
    return "none";
  }
  if (item.proxyPath && previewPath === item.proxyPath) {
    return "proxy";
  }
  return "original";
}

export function getLayerPreviewPlaybackState(item: ProjectItem | undefined): {
  path: string | null;
  blockReason: PreviewBlockReason | null;
} {
  if (!item || item.type !== "footage") {
    return { path: null, blockReason: "error" };
  }

  const safe = getSafePreviewPathForItem(item);
  if (safe) {
    return { path: safe, blockReason: null };
  }

  const status = normalizeCompatibilityStatus(item.compatibilityStatus);
  if (status === "checking-preview") {
    return { path: null, blockReason: "checking" };
  }
  if (status === "proxy-generating") {
    return { path: null, blockReason: "generating" };
  }
  if (isPreviewUnsupported(item)) {
    return { path: null, blockReason: "unsupported" };
  }
  return { path: null, blockReason: "error" };
}

export function getRenderPathForItem(item: ProjectItem): string | undefined {
  if (item.type !== "footage") {
    return undefined;
  }
  return item.path ?? item.originalPath;
}

export function compatibilityStatusLabel(
  status?: MediaCompatibilityStatus | LegacyMediaCompatibilityStatus
): string {
  switch (normalizeCompatibilityStatus(status)) {
    case "imported":
      return "Imported";
    case "checking-preview":
      return "Checking preview…";
    case "native-preview-ok":
      return "Native preview OK";
    case "proxy-ready":
      return "Proxy ready";
    case "native-preview-failed":
      return "Preview unsupported";
    case "proxy-failed":
      return "Proxy failed";
    case "proxy-generating":
      return "Creating preview proxy…";
    case "unsupported":
      return "Unsupported";
    case "error":
      return "Error";
    default:
      return "Imported";
  }
}

export function createFootageProjectItem(input: {
  id: string;
  path: string;
  name: string;
  mediaInfo?: MediaInfo;
  probeError?: string;
}): ProjectItem {
  const canProbe = Boolean(input.mediaInfo);
  return {
    id: input.id,
    type: "footage",
    name: input.name,
    path: input.path,
    originalPath: input.path,
    mediaInfo: input.mediaInfo,
    chromiumPreviewAllowed: true,
    chromiumPreviewVerified: false,
    compatibilityStatus: canProbe ? "imported" : "error",
    compatibilityReason: canProbe
      ? undefined
      : input.probeError ?? "FFprobe could not read file metadata",
    thumbnailStatus: "not-started",
  };
}

export function buildCompatibilityInfo(item: ProjectItem): MediaCompatibilityInfo | null {
  if (item.type !== "footage" || !item.path) {
    return null;
  }
  const status = normalizeCompatibilityStatus(item.compatibilityStatus) ?? "imported";
  return {
    status,
    canProbe: Boolean(item.mediaInfo),
    canNativePreview:
      status === "native-preview-ok" || status === "proxy-ready",
    needsProxy: isPreviewUnsupported(item),
    reason: item.compatibilityReason,
    originalPath: item.originalPath ?? item.path,
    previewPath: getSafePreviewPathForItem(item) ?? undefined,
    proxyPath: item.proxyPath,
  };
}

export async function validateProxyPaths(items: ProjectItem[]): Promise<ProjectItem[]> {
  const proxyPaths = items
    .filter((item) => item.type === "footage" && item.proxyPath)
    .map((item) => item.proxyPath!);

  if (proxyPaths.length === 0) {
    return items;
  }

  const exists = await window.ffmpegStudio.checkMediaPaths(proxyPaths);
  return items.map((item) => {
    if (item.type !== "footage" || !item.proxyPath) {
      return item;
    }
    if (exists[item.proxyPath]) {
      return {
        ...item,
        previewPath: item.proxyPath,
        compatibilityStatus: "proxy-ready" as const,
      };
    }
    return {
      ...item,
      proxyPath: undefined,
      previewPath: undefined,
      compatibilityStatus: "proxy-failed" as const,
      compatibilityReason: "Preview proxy file is missing. Retry proxy.",
    };
  });
}

export function syncFootageChromiumQuarantine(item: ProjectItem): ProjectItem {
  if (item.type !== "footage") {
    return item;
  }

  let next = normalizeProjectItemCompatibility(item);
  const originalPath = next.originalPath ?? next.path;
  if (!originalPath) {
    return next;
  }

  const status = normalizeCompatibilityStatus(next.compatibilityStatus);
  const failed =
    status === "native-preview-failed" || hasFailedNativePreview(originalPath);

  if (!failed) {
    return next;
  }

  blockChromiumOriginalPath(originalPath);

  if (next.chromiumPreviewAllowed !== false) {
    next = {
      ...next,
      chromiumPreviewAllowed: false,
      chromiumPreviewBlockedReason:
        next.chromiumPreviewBlockedReason ?? CHROMIUM_PREVIEW_BLOCKED_REASON,
    };
  }

  if (hasFailedNativePreview(originalPath) && status === "native-preview-ok") {
    next = {
      ...next,
      ...applyChromiumQuarantine(next),
      compatibilityReason:
        next.compatibilityReason ?? "Chromium preview blocked (cached failure)",
    };
  }

  return next;
}

export function normalizeProjectItemCompatibility(
  item: ProjectItem
): ProjectItem {
  if (item.type !== "footage") {
    return item;
  }

  let next = item;
  const normalized = normalizeCompatibilityStatus(item.compatibilityStatus);
  if (normalized && normalized !== item.compatibilityStatus) {
    next = { ...next, compatibilityStatus: normalized };
  }

  const status = normalizeCompatibilityStatus(next.compatibilityStatus);
  if (
    (status === "native-preview-failed" || hasFailedNativePreview(next.originalPath ?? next.path ?? "")) &&
    next.chromiumPreviewAllowed !== false
  ) {
    next = {
      ...next,
      chromiumPreviewAllowed: false,
      chromiumPreviewBlockedReason:
        next.chromiumPreviewBlockedReason ?? CHROMIUM_PREVIEW_BLOCKED_REASON,
    };
  }

  if (next.chromiumPreviewAllowed === undefined && status === "native-preview-ok") {
    next = { ...next, chromiumPreviewAllowed: true };
  }

  if (next.chromiumPreviewAllowed === undefined && next.type === "footage") {
    next = { ...next, chromiumPreviewAllowed: true };
  }

  return next;
}
