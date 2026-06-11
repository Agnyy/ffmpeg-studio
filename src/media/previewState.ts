import type { Job } from "../shared/types";
import type { ProjectItem } from "../shared/project";
import {
  getPreviewSourceKind,
  getSafePreviewPathForItem,
  normalizeCompatibilityStatus,
} from "./mediaCompatibility";

export { normalizeCompatibilityStatus };

export function isPreviewPlayable(item: ProjectItem): boolean {
  return Boolean(getSafePreviewPathForItem(item));
}

export function findProxyJobForItem(
  jobs: Job[],
  itemId: string
): Job | undefined {
  return jobs
    .filter(
      (job) => job.jobKind === "proxy" && job.relatedProjectItemId === itemId
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

export function getProxyJobStatusLabel(job: Job | undefined): string {
  if (!job) {
    return "none";
  }
  return job.status;
}

export function getFootagePreviewStatusLabel(
  item: ProjectItem,
  options?: { isGeneratingProxy?: boolean }
): string {
  const isGeneratingProxy =
    options?.isGeneratingProxy ||
    item.compatibilityStatus === "proxy-generating";

  if (isGeneratingProxy) {
    return "Creating preview proxy…";
  }

  if (item.compatibilityStatus === "checking-preview") {
    return "Checking preview…";
  }

  if (isPreviewPlayable(item)) {
    return getPreviewSourceKind(item) === "proxy" ? "Proxy ready" : "Preview ready";
  }

  const status = normalizeCompatibilityStatus(item.compatibilityStatus);
  switch (status) {
    case "proxy-failed":
      return "Proxy failed";
    case "native-preview-failed":
      return "Preview unsupported";
    case "imported":
      return item.mediaInfo ? "Media ready" : "Imported";
    case "unsupported":
      return "Unsupported";
    case "error":
      return "Error";
    default:
      return "Preview pending";
  }
}

export function needsManualProxyRetry(item: ProjectItem): boolean {
  const status = normalizeCompatibilityStatus(item.compatibilityStatus);
  return (
    status === "proxy-failed" ||
    status === "native-preview-failed"
  );
}

export function shouldAutoCreateProxy(
  item: ProjectItem,
  autoProxyEnabled: boolean
): boolean {
  if (!autoProxyEnabled) {
    return false;
  }
  const status = normalizeCompatibilityStatus(item.compatibilityStatus);
  if (
    status === "proxy-generating" ||
    status === "proxy-ready" ||
    status === "proxy-failed"
  ) {
    return false;
  }
  return status === "native-preview-failed" || status === "imported";
}

export type PreviewDebugInfo = {
  previewSource: "original" | "proxy" | "none";
  compatibilityStatus: string;
  proxyJobStatus: string;
  previewPath: string;
  sourcePath: string;
  proxyPath: string;
  previewPlayable: boolean;
};

export function buildPreviewDebugInfo(
  item: ProjectItem,
  jobs: Job[] = []
): PreviewDebugInfo {
  const previewPath = getSafePreviewPathForItem(item) ?? item.previewPath ?? "";
  const proxyJob = findProxyJobForItem(jobs, item.id);
  return {
    previewSource: getPreviewSourceKind(item),
    compatibilityStatus:
      normalizeCompatibilityStatus(item.compatibilityStatus) ?? "imported",
    proxyJobStatus: getProxyJobStatusLabel(proxyJob),
    previewPath: previewPath || "—",
    sourcePath: item.originalPath ?? item.path ?? "—",
    proxyPath: item.proxyPath ?? "—",
    previewPlayable: isPreviewPlayable(item),
  };
}
