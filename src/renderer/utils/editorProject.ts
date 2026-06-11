import { createEditClipJob } from "../../jobs/jobFactory";
import { layerToEditOptionsFromLayer } from "../../ffmpeg/editCommandBuilder";
import type { ExportSettings } from "../../shared/projectDocument";
import type { ProjectItem, TimelineLayer } from "../../shared/project";
import type { Job } from "../../shared/types";

export function rebuildJobsFromState(
  timelineLayers: TimelineLayer[],
  compWidth: number,
  compHeight: number,
  exportSettings: ExportSettings,
  mediaDimensions: Record<string, { width: number; height: number }> = {}
): Job[] {
  const jobs: Job[] = [];

  for (const layer of timelineLayers) {
    if (!layer.sourcePath) {
      continue;
    }

    const dims = mediaDimensions[layer.sourcePath] ?? { width: 0, height: 0 };
    const sourceWidth =
      layer.cropEnabled && layer.crop ? layer.crop.width : dims.width;
    const sourceHeight =
      layer.cropEnabled && layer.crop ? layer.crop.height : dims.height;

    const job = createEditClipJob(
      layer.sourcePath,
      layerToEditOptionsFromLayer(
        layer,
        { width: compWidth, height: compHeight },
        { width: sourceWidth, height: sourceHeight },
        exportSettings
      ),
      undefined,
      layer.outPoint - layer.inPoint
    );
    jobs.push(job);
  }

  return jobs;
}

export function updateLayersAfterRelink(
  layers: TimelineLayer[],
  sourceItemId: string,
  oldPath: string,
  newPath: string
): TimelineLayer[] {
  return layers.map((layer) => {
    if (layer.sourceItemId !== sourceItemId && layer.sourcePath !== oldPath) {
      return layer;
    }
    return {
      ...layer,
      sourceItemId,
      sourcePath: newPath,
    };
  });
}

export function markMissingMediaItems(items: ProjectItem[]): ProjectItem[] {
  return items.map((item) => {
    if (item.type !== "footage" || !item.path) {
      return item;
    }
    return item;
  });
}
