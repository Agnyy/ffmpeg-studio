import { applyFilterRecipe } from "../effects/applyFilterRecipe";
import type { FilterRecipe } from "../effects/filterRecipes";
import {
  buildCompositionRenderArgs,
  type CompositionRenderInput,
} from "../ffmpeg/compositionRenderBuilder";
import { createCompositionRenderJob } from "../jobs/jobFactory";
import {
  createCompositionItem,
  createTimelineLayer,
  ensureLayerTransform,
  type ProjectItem,
  type TimelineLayer,
} from "../shared/project";
import type { ExportSettings } from "../shared/projectDocument";
import { getBasename } from "../shared/pathUtils";
import type { Job } from "../shared/types";
import type { FfmpegFilterAvailability } from "../effects/applyFilterRecipe";

export function createTemporaryLayerForMediaItem(
  item: ProjectItem,
  compWidth: number,
  compHeight: number
): TimelineLayer {
  const duration = item.mediaInfo?.durationSeconds ?? 10;
  const layer = createTimelineLayer(
    item.id,
    item.path!,
    item.name,
    duration,
    1,
    compWidth,
    compHeight,
    0
  );
  return ensureLayerTransform(layer, compWidth, compHeight);
}

export function createTemporaryCompositionForMediaItem(
  item: ProjectItem,
  recipe: FilterRecipe,
  exportSettings: ExportSettings,
  outputPath: string,
  availability: FfmpegFilterAvailability,
  paramOverrides?: Record<string, string | number | boolean>
): {
  renderInput: CompositionRenderInput;
  warnings: string[];
  blocked?: string;
} {
  const compItem = createCompositionItem(item.mediaInfo, item.name);
  const compMeta = compItem.composition!;
  let compWidth = compMeta.width;
  let compHeight = compMeta.height;
  const fps = compMeta.fps;
  const duration = compMeta.duration;

  const layer = createTemporaryLayerForMediaItem(item, compWidth, compHeight);

  const result = applyFilterRecipe({
    recipe,
    selectedLayer: layer,
    composition: { width: compWidth, height: compHeight, fps },
    exportSettings,
    ffmpegFilterAvailability: availability,
    layerMediaInfo: item.mediaInfo,
    paramOverrides,
    batchMode: true,
  });

  if (result.blocked) {
    return { renderInput: null as unknown as CompositionRenderInput, warnings: [], blocked: result.blockReason };
  }

  if (result.updatedComposition?.width) {
    compWidth = result.updatedComposition.width;
  }
  if (result.updatedComposition?.height) {
    compHeight = result.updatedComposition.height;
  }

  const mergedLayer = ensureLayerTransform(
    { ...layer, ...result.updatedLayer },
    compWidth,
    compHeight
  );

  const mergedExport: ExportSettings = {
    ...exportSettings,
    ...result.updatedExportSettings,
  };

  const renderInput: CompositionRenderInput = {
    composition: {
      name: item.name,
      width: compWidth,
      height: compHeight,
      fps,
      duration,
      workAreaStart: 0,
      workAreaEnd: duration,
    },
    layers: [mergedLayer],
    mediaInfoByPath: {
      [item.path!]: {
        width: item.mediaInfo?.width,
        height: item.mediaInfo?.height,
      },
    },
    selectedLayerId: mergedLayer.id,
    renderRange: "full",
    outputPath,
    exportCrf: mergedExport.exportCrf,
    exportPreset: mergedExport.exportPreset,
    exportAudioBitrate: mergedExport.exportAudioBitrate,
  };

  return { renderInput, warnings: result.warnings };
}

export function createBatchRenderJobForItem(
  item: ProjectItem,
  recipe: FilterRecipe,
  exportSettings: ExportSettings,
  outputPath: string,
  availability: FfmpegFilterAvailability,
  paramOverrides?: Record<string, string | number | boolean>
): { job: Job | null; warnings: string[]; error?: string } {
  if (!item.path || item.missing) {
    return { job: null, warnings: [], error: "Missing source file" };
  }

  const { renderInput, warnings, blocked } = createTemporaryCompositionForMediaItem(
    item,
    recipe,
    exportSettings,
    outputPath,
    availability,
    paramOverrides
  );

  if (blocked) {
    return { job: null, warnings, error: blocked };
  }

  const built = buildCompositionRenderArgs(renderInput);
  const inputName = getBasename(item.path);
  const outputName = getBasename(outputPath);
  const job = createCompositionRenderJob(
    item.path,
    outputPath,
    built.args,
    built.renderDuration,
    item.name
  );

  return {
    job: {
      ...job,
      title: `Render: ${inputName} → ${outputName}`,
      relatedProjectItemId: item.id,
    },
    warnings: [...warnings, ...built.warnings],
  };
}

export function createBatchPassthroughRenderJobForItem(
  item: ProjectItem,
  exportSettings: ExportSettings,
  outputPath: string
): { job: Job | null; error?: string } {
  if (!item.path || item.missing) {
    return { job: null, error: "Missing source file" };
  }

  const fakeRecipe: FilterRecipe = {
    id: "batch-passthrough",
    title: "Batch export",
    category: "Export",
    description: "",
    difficulty: "simple",
    target: "export",
    requiredFilters: [],
    actions: [],
  };

  const { renderInput, blocked } = createTemporaryCompositionForMediaItem(
    item,
    fakeRecipe,
    exportSettings,
    outputPath,
    { hasFilter: () => true }
  );

  if (blocked) {
    return { job: null, error: blocked };
  }

  const built = buildCompositionRenderArgs(renderInput);
  const job = createCompositionRenderJob(
    item.path,
    outputPath,
    built.args,
    built.renderDuration,
    item.name
  );

  return {
    job: {
      ...job,
      title: `Render: ${getBasename(item.path)}`,
      relatedProjectItemId: item.id,
    },
  };
}
