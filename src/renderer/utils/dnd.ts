import type { DragEvent as ReactDragEvent } from "react";

export function extractDroppedPaths(event: DragEvent | ReactDragEvent): string[] {
  const files = Array.from(event.dataTransfer?.files ?? []);
  console.log("[DND] dropped files", files);

  const paths = files
    .map((file) => {
      try {
        return window.ffmpegStudio.getPathForFile(file);
      } catch (err) {
        console.error("[DND] getPathForFile failed", err);
        return "";
      }
    })
    .filter((path) => path.length > 0);

  console.log("[DND] resolved paths", paths);
  return paths;
}

export function preventDragDefaults(event: DragEvent | ReactDragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  const transfer = "dataTransfer" in event ? event.dataTransfer : null;
  if (transfer) {
    transfer.dropEffect = "copy";
  }
}
