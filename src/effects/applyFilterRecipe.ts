import { getCatalogEffectById } from "./ffmpegEffectCatalog";
import type { FilterRecipe, FilterRecipeAction, FilterRecipeTarget } from "./filterRecipes";
import { createLayerEffect, type LayerEffect } from "../shared/effects";
import type { CompositionMeta, TimelineLayer } from "../shared/project";
import type { ExportSettings } from "../shared/projectDocument";
import type { LayerTransform } from "../shared/transform";
import type { MediaInfo } from "../shared/types";

export type FfmpegFilterAvailability = {
  hasFilter: (filterName: string) => boolean;
};

export type ApplyFilterRecipeInput = {
  recipe: FilterRecipe;
  selectedLayer: TimelineLayer | null;
  composition: { width: number; height: number; fps: number };
  exportSettings: ExportSettings;
  ffmpegFilterAvailability: FfmpegFilterAvailability;
  layerMediaInfo?: MediaInfo;
  paramOverrides?: Record<string, string | number | boolean>;
  /** Skip background task side effects (preview cache, analysis) for batch processing. */
  batchMode?: boolean;
};

export type ResolvedRecipeAction = FilterRecipeAction & {
  description: string;
  skipped?: boolean;
  skipReason?: string;
};

export type RecipePlan = {
  recipe: FilterRecipe;
  actions: ResolvedRecipeAction[];
  warnings: string[];
  missingFilters: string[];
  fallbackNote?: string;
  disabled: boolean;
  disabledReason?: string;
  requiresLayer: boolean;
  badges: string[];
};

export type ApplyFilterRecipeResult = {
  updatedLayer?: Partial<TimelineLayer>;
  updatedComposition?: Partial<CompositionMeta>;
  updatedExportSettings?: Partial<ExportSettings>;
  jobsToCreate: Array<"proxy" | "preview-cache" | "analysis">;
  addedEffects: LayerEffect[];
  warnings: string[];
  actionSummaries: string[];
  blocked: boolean;
  blockReason?: string;
};

function hasVidstab(availability: FfmpegFilterAvailability): boolean {
  return (
    availability.hasFilter("vidstabdetect") && availability.hasFilter("vidstabtransform")
  );
}

function hasDeshake(availability: FfmpegFilterAvailability): boolean {
  return availability.hasFilter("deshake");
}

function missingRequiredFilters(
  recipe: FilterRecipe,
  availability: FfmpegFilterAvailability
): string[] {
  return recipe.requiredFilters.filter((name) => !availability.hasFilter(name));
}

function effectRequiresFilter(effectId: string): string[] {
  const def = getCatalogEffectById(effectId);
  return def?.ffmpegFilters ?? [];
}

function canApplyEffect(effectId: string, availability: FfmpegFilterAvailability): boolean {
  const filters = effectRequiresFilter(effectId);
  if (filters.length === 0) {
    return true;
  }
  return filters.every((name) => availability.hasFilter(name));
}

function computeFillTransform(
  compWidth: number,
  compHeight: number,
  videoWidth: number,
  videoHeight: number,
  transform: LayerTransform
): LayerTransform {
  const scale = Math.max(compWidth / videoWidth, compHeight / videoHeight) * 100;
  return {
    ...transform,
    positionX: compWidth / 2,
    positionY: compHeight / 2,
    scaleX: scale,
    scaleY: scale,
  };
}

function targetBadge(target: FilterRecipeTarget): string {
  switch (target) {
    case "selected-layer":
      return "Layer";
    case "composition":
      return "Composition";
    case "export":
      return "Export";
  }
}

function describeAction(action: FilterRecipeAction): string {
  switch (action.type) {
    case "add-effect": {
      const def = getCatalogEffectById(action.effectId);
      const name = def?.name ?? action.effectId;
      return `Add ${name} to selected layer`;
    }
    case "set-composition": {
      const parts: string[] = [];
      if (action.width && action.height) {
        parts.push(`Set composition to ${action.width}×${action.height}`);
      }
      if (action.fps) {
        parts.push(`Set frame rate to ${action.fps} fps`);
      }
      return parts.join("; ") || "Update composition settings";
    }
    case "set-export": {
      const parts: string[] = ["Update export settings"];
      if (action.crf !== undefined) {
        parts.push(`CRF ${action.crf}`);
      }
      if (action.preset) {
        parts.push(`preset ${action.preset}`);
      }
      if (action.audioBitrate) {
        parts.push(`AAC ${action.audioBitrate}`);
      }
      if (action.maxOutputWidth) {
        parts.push(`target max width ${action.maxOutputWidth}px`);
      }
      return parts.join(" — ");
    }
    case "set-layer-fill":
      return "Fill composition frame for selected layer";
    case "create-task":
      switch (action.jobKind) {
        case "analysis":
          return "Create Analyze Motion background task";
        case "preview-cache":
          return "Create preview cache background task";
        case "proxy":
          return "Create preview proxy background task";
      }
  }
}

function resolveStabilizeActions(
  recipe: FilterRecipe,
  availability: FfmpegFilterAvailability
): {
  actions: FilterRecipeAction[];
  missingFilters: string[];
  fallbackNote?: string;
  disabled?: boolean;
  disabledReason?: string;
} {
  if (hasVidstab(availability)) {
    return {
      actions: recipe.actions,
      missingFilters: [],
    };
  }

  const missing = ["vidstabdetect", "vidstabtransform"].filter(
    (name) => !availability.hasFilter(name)
  );

  if (hasDeshake(availability)) {
    return {
      actions: [
        { type: "add-effect", effectId: "deshake", params: { strength: "medium" } },
      ],
      missingFilters: missing,
      fallbackNote: "Simple Deshake will be used instead of VidStab.",
    };
  }

  return {
    actions: [],
    missingFilters: missing,
    disabled: true,
    disabledReason: "No stabilization filters available in this FFmpeg build.",
  };
}

function resolveNormalizeVoiceActions(
  availability: FfmpegFilterAvailability
): {
  actions: FilterRecipeAction[];
  missingFilters: string[];
  fallbackNote?: string;
  disabled?: boolean;
  disabledReason?: string;
} {
  if (availability.hasFilter("loudnorm")) {
    return {
      actions: [{ type: "add-effect", effectId: "loudnorm", params: { integrated: -16 } }],
      missingFilters: [],
    };
  }

  return {
    actions: [{ type: "add-effect", effectId: "audioVolume", params: { volume: 1.2 } }],
    missingFilters: ["loudnorm"],
    fallbackNote: "loudnorm unavailable — using volume boost instead.",
  };
}

function resolveCleanVoiceActions(availability: FfmpegFilterAvailability): {
  actions: FilterRecipeAction[];
  missingFilters: string[];
  fallbackNote?: string;
  disabled?: boolean;
  disabledReason?: string;
} {
  const required = ["highpass", "lowpass", "acompressor"];
  const missing = required.filter((name) => !availability.hasFilter(name));
  if (missing.length > 0) {
    return {
      actions: [],
      missingFilters: missing,
      disabled: true,
      disabledReason: `Missing audio filters: ${missing.join(", ")}`,
    };
  }

  const actions: FilterRecipeAction[] = [
    { type: "add-effect", effectId: "highpass", params: { frequency: 80 } },
    { type: "add-effect", effectId: "lowpass", params: { frequency: 12000 } },
    { type: "add-effect", effectId: "acompressor" },
  ];

  let fallbackNote: string | undefined;
  if (availability.hasFilter("loudnorm")) {
    actions.push({ type: "add-effect", effectId: "loudnorm", params: { integrated: -16 } });
  } else {
    fallbackNote = "loudnorm unavailable — skipping loudness normalize step.";
  }

  return { actions, missingFilters: [], fallbackNote };
}

function resolveRecipeActions(
  recipe: FilterRecipe,
  availability: FfmpegFilterAvailability
): {
  actions: FilterRecipeAction[];
  missingFilters: string[];
  fallbackNote?: string;
  disabled?: boolean;
  disabledReason?: string;
} {
  if (recipe.id === "stabilize-shaky-video") {
    return resolveStabilizeActions(recipe, availability);
  }
  if (recipe.id === "normalize-voice-audio") {
    return resolveNormalizeVoiceActions(availability);
  }
  if (recipe.id === "clean-voice-audio") {
    return resolveCleanVoiceActions(availability);
  }

  const missing = missingRequiredFilters(recipe, availability);
  if (missing.length > 0) {
    return {
      actions: [],
      missingFilters: missing,
      disabled: true,
      disabledReason: `Missing filters: ${missing.join(", ")}`,
    };
  }

  return { actions: recipe.actions, missingFilters: [] };
}

function recipeUsesAnalysis(actions: FilterRecipeAction[]): boolean {
  return actions.some(
    (action) => action.type === "create-task" && action.jobKind === "analysis"
  );
}

function recipeHasRenderOnlyEffects(actions: FilterRecipeAction[]): boolean {
  return actions.some((action) => {
    if (action.type !== "add-effect") {
      return false;
    }
    const def = getCatalogEffectById(action.effectId);
    return def?.capability.includes("render-only") ?? false;
  });
}

export function buildRecipePlan(
  recipe: FilterRecipe,
  availability: FfmpegFilterAvailability
): RecipePlan {
  const resolved = resolveRecipeActions(recipe, availability);
  const warnings = [...(recipe.warnings ?? [])];

  const actions: ResolvedRecipeAction[] = resolved.actions.map((action) => {
    if (action.type === "add-effect" && !canApplyEffect(action.effectId, availability)) {
      return {
        ...action,
        description: describeAction(action),
        skipped: true,
        skipReason: `${action.effectId} filter unavailable`,
      };
    }
    return {
      ...action,
      description: describeAction(action),
    };
  });

  const badges: string[] = [targetBadge(recipe.target)];
  if (recipeHasRenderOnlyEffects(resolved.actions)) {
    badges.push("Render-only");
  }
  if (recipeUsesAnalysis(resolved.actions)) {
    badges.push("Requires analysis");
  }
  if (resolved.missingFilters.length > 0 && !resolved.disabled) {
    badges.push("Fallback");
  }
  if (resolved.disabled) {
    badges.push("Missing filters");
  }

  return {
    recipe,
    actions,
    warnings,
    missingFilters: resolved.missingFilters,
    fallbackNote: resolved.fallbackNote,
    disabled: resolved.disabled ?? false,
    disabledReason: resolved.disabledReason,
    requiresLayer:
      recipe.target === "selected-layer" ||
      resolved.actions.some(
        (action) =>
          action.type === "add-effect" ||
          action.type === "set-layer-fill" ||
          (action.type === "create-task" && action.jobKind === "analysis")
      ),
    badges,
  };
}

function createEffectFromAction(
  action: Extract<FilterRecipeAction, { type: "add-effect" }>,
  paramOverrides?: Record<string, string | number | boolean>
): LayerEffect {
  const effect = createLayerEffect(action.effectId as import("../shared/effects").LayerEffectType);
  const params = { ...effect.params, ...action.params, ...paramOverrides };
  return { ...effect, params, collapsed: false };
}

export function applyFilterRecipe(input: ApplyFilterRecipeInput): ApplyFilterRecipeResult {
  const {
    recipe,
    selectedLayer,
    composition,
    ffmpegFilterAvailability,
    layerMediaInfo,
    paramOverrides,
    batchMode = false,
  } = input;

  const plan = buildRecipePlan(recipe, ffmpegFilterAvailability);

  if (plan.disabled) {
    return {
      jobsToCreate: [],
      addedEffects: [],
      warnings: plan.warnings,
      actionSummaries: [],
      blocked: true,
      blockReason: plan.disabledReason,
    };
  }

  if (plan.requiresLayer && !selectedLayer) {
    return {
      jobsToCreate: [],
      addedEffects: [],
      warnings: plan.warnings,
      actionSummaries: [],
      blocked: true,
      blockReason: "Select a layer first",
    };
  }

  const warnings = [...plan.warnings];
  if (plan.fallbackNote) {
    warnings.push(plan.fallbackNote);
  }

  const actionSummaries: string[] = [];
  const jobsToCreate: ApplyFilterRecipeResult["jobsToCreate"] = [];
  const addedEffects: LayerEffect[] = [];
  let updatedComposition: Partial<CompositionMeta> | undefined;
  let updatedExportSettings: Partial<ExportSettings> | undefined;
  let updatedLayer: Partial<TimelineLayer> | undefined;

  let nextEffects = [...(selectedLayer?.effects ?? [])];
  let nextTransform = selectedLayer?.transform;

  for (const action of plan.actions) {
    if ("skipped" in action && action.skipped) {
      warnings.push(action.skipReason ?? "Skipped unavailable step");
      continue;
    }

    switch (action.type) {
      case "add-effect": {
        if (!canApplyEffect(action.effectId, ffmpegFilterAvailability)) {
          warnings.push(`Skipped ${action.effectId} — filter unavailable`);
          break;
        }
        const overrides =
          recipe.id === "quick-deshake" && paramOverrides?.strength
            ? { strength: paramOverrides.strength }
            : undefined;
        const effect = createEffectFromAction(action, overrides);
        addedEffects.push(effect);
        nextEffects = [...nextEffects, effect];
        actionSummaries.push(`Added ${effect.name}`);
        break;
      }
      case "set-composition": {
        updatedComposition = {
          ...updatedComposition,
          ...(action.width !== undefined ? { width: action.width } : {}),
          ...(action.height !== undefined ? { height: action.height } : {}),
          ...(action.fps !== undefined ? { fps: action.fps } : {}),
        };
        actionSummaries.push(describeAction(action));
        break;
      }
      case "set-export": {
        updatedExportSettings = {
          ...updatedExportSettings,
          ...(action.crf !== undefined ? { exportCrf: action.crf } : {}),
          ...(action.preset ? { exportPreset: action.preset } : {}),
          ...(action.audioBitrate ? { exportAudioBitrate: action.audioBitrate } : {}),
        };
        if (action.format || action.codec) {
          warnings.push(
            `Export format ${action.format ?? "mp4"} / ${action.codec ?? "h264"} is used by the render pipeline.`
          );
        }
        actionSummaries.push(describeAction(action));
        break;
      }
      case "set-layer-fill": {
        if (!selectedLayer || !nextTransform) {
          break;
        }
        const videoWidth = layerMediaInfo?.width ?? composition.width;
        const videoHeight = layerMediaInfo?.height ?? composition.height;
        const compW = updatedComposition?.width ?? composition.width;
        const compH = updatedComposition?.height ?? composition.height;
        nextTransform = computeFillTransform(
          compW,
          compH,
          videoWidth,
          videoHeight,
          nextTransform
        );
        actionSummaries.push("Filled layer to composition frame");
        break;
      }
      case "create-task": {
        if (batchMode) {
          break;
        }
        jobsToCreate.push(action.jobKind);
        actionSummaries.push(describeAction(action));
        break;
      }
    }
  }

  if (selectedLayer && (addedEffects.length > 0 || nextTransform !== selectedLayer.transform)) {
    updatedLayer = {
      collapsed: false,
      effects: nextEffects,
      ...(nextTransform ? { transform: nextTransform } : {}),
    };
  }

  if (!updatedExportSettings) {
    updatedExportSettings = undefined;
  }

  return {
    updatedLayer,
    updatedComposition,
    updatedExportSettings,
    jobsToCreate,
    addedEffects,
    warnings,
    actionSummaries,
    blocked: false,
  };
}
