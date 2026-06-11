import type { ProjectItem, TimelineLayer } from "../../../shared/project";
import { layerFootageOriginalPath } from "../preview/resolveLayerFootage";

export type EnginePreviewTarget = {
  layer: TimelineLayer;
  originalPath: string;
  footageItem: ProjectItem | null;
};

function isPreviewableFootageLayer(layer: TimelineLayer): boolean {
  return layer.enabled && layer.hasVideo && Boolean(layer.sourcePath?.trim());
}

export function resolveEnginePreviewLayer(
  timelineLayers: TimelineLayer[],
  selectedLayer: TimelineLayer | null,
  projectItems: ProjectItem[]
): EnginePreviewTarget | null {
  const candidates: TimelineLayer[] = [];

  if (selectedLayer && isPreviewableFootageLayer(selectedLayer)) {
    candidates.push(selectedLayer);
  }

  const sorted = [...timelineLayers]
    .filter(isPreviewableFootageLayer)
    .sort((a, b) => a.index - b.index);

  for (const layer of sorted) {
    if (!candidates.some((entry) => entry.id === layer.id)) {
      candidates.push(layer);
    }
  }

  for (const layer of candidates) {
    const originalPath = layerFootageOriginalPath(projectItems, layer);
    if (!originalPath) {
      continue;
    }
    return {
      layer,
      originalPath,
      footageItem:
        projectItems.find(
          (item) =>
            item.type === "footage" &&
            !item.missing &&
            (item.path?.trim() === layer.sourcePath?.trim() ||
              item.originalPath?.trim() === layer.sourcePath?.trim())
        ) ?? null,
    };
  }

  return null;
}
