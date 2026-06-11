import type { FilterRecipe } from "../effects/filterRecipes";
import { FILTER_RECIPES } from "../effects/filterRecipes";
import type { FfmpegFilterAvailability } from "../effects/applyFilterRecipe";
import { buildRecipePlan } from "../effects/applyFilterRecipe";

/** Recipes supported in batch v1 (no analysis / preview-cache side effects). */
export const BATCH_SUPPORTED_RECIPE_IDS = [
  "compress-for-telegram",
  "high-quality-master",
  "prepare-youtube-shorts",
  "square-social-video",
  "normalize-voice-audio",
  "clean-voice-audio",
  "make-video-sharper",
  "clean-noisy-low-light",
  "strong-denoise",
  "quick-deshake",
  "remove-flicker",
] as const;

export type BatchSupportedRecipeId = (typeof BATCH_SUPPORTED_RECIPE_IDS)[number];

const BATCH_UNSUPPORTED: Record<string, string> = {
  "stabilize-shaky-video":
    "Advanced VidStab batch workflow is not supported yet. Use Quick Deshake for batch.",
};

export function getBatchSupportedRecipes(): FilterRecipe[] {
  return FILTER_RECIPES.filter((recipe) =>
    (BATCH_SUPPORTED_RECIPE_IDS as readonly string[]).includes(recipe.id)
  );
}

export function isBatchRecipeSupported(recipeId: string): boolean {
  return (BATCH_SUPPORTED_RECIPE_IDS as readonly string[]).includes(recipeId);
}

export function getBatchRecipeBlockReason(
  recipeId: string,
  availability: FfmpegFilterAvailability
): string | null {
  if (BATCH_UNSUPPORTED[recipeId]) {
    return BATCH_UNSUPPORTED[recipeId];
  }
  if (!isBatchRecipeSupported(recipeId)) {
    return "This preset is not available for batch processing yet.";
  }
  const recipe = FILTER_RECIPES.find((entry) => entry.id === recipeId);
  if (!recipe) {
    return "Unknown preset.";
  }
  const plan = buildRecipePlan(recipe, availability);
  if (plan.disabled) {
    return plan.disabledReason ?? "Preset unavailable in this FFmpeg build.";
  }
  return null;
}
