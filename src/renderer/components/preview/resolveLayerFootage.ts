import type { ProjectItem, TimelineLayer } from "../../../shared/project";

export function findFootageForLayer(
  projectItems: ProjectItem[],
  layer: TimelineLayer
): ProjectItem | null {
  const sourcePath = layer.sourcePath?.trim();
  if (!sourcePath) {
    return null;
  }

  return (
    projectItems.find(
      (item) =>
        item.type === "footage" &&
        !item.missing &&
        (item.path?.trim() === sourcePath || item.originalPath?.trim() === sourcePath)
    ) ?? null
  );
}

export function layerFootageOriginalPath(
  projectItems: ProjectItem[],
  layer: TimelineLayer
): string {
  const item = findFootageForLayer(projectItems, layer);
  return (
    item?.originalPath?.trim() ||
    item?.path?.trim() ||
    layer.sourcePath?.trim() ||
    ""
  );
}
