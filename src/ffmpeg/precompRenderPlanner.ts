import type { ProjectItem, TimelineLayer } from "../shared/project";
import { isPrecompLayer } from "../shared/project";
import {
  buildCompositionRenderArgs,
  type CompositionRenderInput,
  type CompositionRenderResult,
} from "./compositionRenderBuilder";
import { createCompositionRenderJob } from "../jobs/jobFactory";
import type { Job } from "../shared/types";

export type PrecompRenderPlannerContext = {
  projectItems: ProjectItem[];
  getLayersForComposition: (compositionId: string) => TimelineLayer[];
  resolvePrecompCachePath: (
    renderJobId: string,
    precompLayerId: string
  ) => Promise<string>;
};

export type PrecompRenderPlan = {
  warnings: string[];
  precompJobs: Job[];
  cleanupPaths: string[];
  parentInput: CompositionRenderInput;
  parentBuilt: CompositionRenderResult;
};

function findCompositionItem(
  projectItems: ProjectItem[],
  compositionId: string
): ProjectItem | undefined {
  return projectItems.find(
    (item) => item.type === "composition" && item.id === compositionId
  );
}

function filterNestedRenderableLayers(
  layers: TimelineLayer[],
  warnings: string[]
): TimelineLayer[] {
  const renderable: TimelineLayer[] = [];
  for (const layer of layers) {
    if (!layer.enabled) {
      continue;
    }
    if (isPrecompLayer(layer)) {
      warnings.push("Nested precomp deeper than 1 level is not supported yet.");
      continue;
    }
    if (!layer.sourcePath) {
      continue;
    }
    renderable.push(layer);
  }
  return renderable;
}

export function collectPrecompRenderWarnings(
  layers: TimelineLayer[],
  getLayersForComposition: (compositionId: string) => TimelineLayer[]
): string[] {
  const warnings: string[] = [];
  for (const layer of layers) {
    if (!layer.enabled || !isPrecompLayer(layer) || !layer.sourceCompositionId) {
      continue;
    }
    if (layer.hasAudio) {
      warnings.push(
        `Precomp layer "${layer.name}": Precomp audio is not supported yet.`
      );
    }
    const nestedLayers = getLayersForComposition(layer.sourceCompositionId);
    filterNestedRenderableLayers(nestedLayers, warnings);
  }
  return warnings;
}

export async function buildPrecompRenderPlan(
  parentInput: CompositionRenderInput,
  parentRenderJobId: string,
  context: PrecompRenderPlannerContext
): Promise<PrecompRenderPlan> {
  const warnings: string[] = [];
  const precompJobs: Job[] = [];
  const cleanupPaths: string[] = [];
  const precompSourceByLayerId: Record<string, string> = {};
  const mediaInfoByPath = { ...parentInput.mediaInfoByPath };

  const precompLayers = parentInput.layers.filter(
    (layer) => layer.enabled && isPrecompLayer(layer) && layer.sourceCompositionId
  );

  for (const layer of precompLayers) {
    const compositionId = layer.sourceCompositionId!;
    const compItem = findCompositionItem(context.projectItems, compositionId);

    if (layer.hasAudio) {
      warnings.push(
        `Precomp layer "${layer.name}": Precomp audio is not supported yet.`
      );
    }

    if (!compItem?.composition) {
      warnings.push(
        `Precomp layer "${layer.name}": nested composition not found — skipped in render.`
      );
      continue;
    }

    const nestedLayers = context.getLayersForComposition(compositionId);
    const renderableNestedLayers = filterNestedRenderableLayers(
      nestedLayers,
      warnings
    );

    if (renderableNestedLayers.length === 0) {
      warnings.push(
        `Precomp layer "${layer.name}": nested composition has no renderable footage — skipped.`
      );
      continue;
    }

    const intermediatePath = await context.resolvePrecompCachePath(
      parentRenderJobId,
      layer.id
    );
    precompSourceByLayerId[layer.id] = intermediatePath;
    cleanupPaths.push(intermediatePath);

    const nestedMeta = compItem.composition;
    const nestedInput: CompositionRenderInput = {
      composition: {
        name: compItem.name,
        width: nestedMeta.width,
        height: nestedMeta.height,
        fps: nestedMeta.fps,
        duration: nestedMeta.duration,
        workAreaStart: 0,
        workAreaEnd: nestedMeta.duration,
      },
      layers: renderableNestedLayers,
      mediaInfoByPath: parentInput.mediaInfoByPath,
      selectedLayerId: null,
      renderRange: "full",
      outputPath: intermediatePath,
      exportCrf: parentInput.exportCrf,
      exportPreset: parentInput.exportPreset,
      exportAudioBitrate: parentInput.exportAudioBitrate,
    };

    const nestedBuilt = buildCompositionRenderArgs(nestedInput);
    warnings.push(
      ...nestedBuilt.warnings.map(
        (warning) => `Precomp "${compItem.name}": ${warning}`
      )
    );

    const primaryInput =
      nestedBuilt.renderLayers[0]?.sourcePath ??
      renderableNestedLayers.find((entry) => entry.sourcePath)?.sourcePath ??
      intermediatePath;

    precompJobs.push({
      ...createCompositionRenderJob(
        primaryInput,
        intermediatePath,
        nestedBuilt.args,
        nestedBuilt.renderDuration,
        compItem.name
      ),
      title: `Render Precomp: ${compItem.name}`,
    });

    mediaInfoByPath[intermediatePath] = {
      width: nestedMeta.width,
      height: nestedMeta.height,
    };
  }

  const mergedParentInput: CompositionRenderInput = {
    ...parentInput,
    mediaInfoByPath,
    precompSourceByLayerId,
  };

  const parentBuilt = buildCompositionRenderArgs(mergedParentInput);
  warnings.push(...parentBuilt.warnings);

  return {
    warnings: [...new Set(warnings)],
    precompJobs,
    cleanupPaths,
    parentInput: mergedParentInput,
    parentBuilt,
  };
}
