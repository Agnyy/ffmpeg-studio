import type { MediaCompatibilityStatus } from "./mediaCompatibility";

import type { ProjectItem } from "../shared/project";

import { extractThumbnailDataUrl } from "./thumbnailDebugPipe";

import { getFootagePreviewStatusLabel } from "./previewState";



export type ThumbnailStatus =

  | "not-started"

  | "generating"

  | "loading-image"

  | "ready"

  | "fallback"

  | "failed";



export function resolveThumbnailStatus(item: ProjectItem): ThumbnailStatus {

  if (extractThumbnailDataUrl(item.thumbnailDataUrl)) {

    return "ready";

  }

  if (item.thumbnailStatus === "ready") {

    return "not-started";

  }

  return item.thumbnailStatus ?? "not-started";

}



export function projectPreviewStatusSuffix(

  item: ProjectItem,

  isGeneratingProxy: boolean

): string | null {

  if (item.type !== "footage" || item.missing || !item.mediaInfo) {

    return null;

  }

  const label = getFootagePreviewStatusLabel(item, { isGeneratingProxy });

  if (
    label === "Imported" ||
    label === "Media ready" ||
    label === "Preview pending" ||
    label === "Checking preview…"
  ) {
    return null;
  }

  return label;

}



export function projectPanelFootageStatus(

  item: ProjectItem,

  isGeneratingProxy: boolean

): string {

  const media = mediaStatusLabel(item);

  const preview = projectPreviewStatusSuffix(item, isGeneratingProxy);

  return preview ? `${media} · ${preview}` : media;

}



export function previewStatusLabel(

  status?: MediaCompatibilityStatus,

  item?: ProjectItem,

  isGeneratingProxy?: boolean

): string {

  if (item) {

    return getFootagePreviewStatusLabel(item, { isGeneratingProxy });

  }

  return getFootagePreviewStatusLabel(

    { type: "footage", id: "", name: "", compatibilityStatus: status } as ProjectItem,

    { isGeneratingProxy }

  );

}



export function thumbnailStatusLabel(status?: ThumbnailStatus): string {

  switch (status) {

    case "generating":

      return "Thumbnail generating…";

    case "loading-image":

      return "Thumbnail generating…";

    case "ready":

      return "Thumbnail ready";

    case "fallback":

      return "Thumbnail fallback";

    case "failed":

      return "Thumbnail failed";

    case "not-started":

    default:

      return "Thumbnail missing";

  }

}



export function mediaStatusLabel(item: ProjectItem): string {

  if (item.missing) {

    return "Missing media";

  }

  if (!item.mediaInfo) {

    return "Probing…";

  }

  return "Media ready";

}



export function footageCompactStatus(

  item: ProjectItem,

  isGeneratingProxy: boolean

): string {

  if (item.missing) {

    return "Missing";

  }

  if (!item.mediaInfo) {

    return "Probing…";

  }



  const preview = projectPreviewStatusSuffix(item, isGeneratingProxy);

  if (preview) {

    return preview;

  }

  return "";

}


