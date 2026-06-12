import type { LayerEffectType } from "../../shared/effects";
import type { RecipePlan, FfmpegFilterAvailability } from "../../effects/applyFilterRecipe";
import { buildRecipePlan } from "../../effects/applyFilterRecipe";
import {
  getEffectBadges,
  getEffectUnavailableTooltip,
  type EffectBadgeKind,
  type FfmpegEffectDefinition,
} from "../../effects/ffmpegEffectCatalog";
import type { FilterRecipe } from "../../effects/filterRecipes";

export type EffectLeaf = {
  type: "effect";
  id: string;
  label: string;
  effectType: LayerEffectType;
  catalogDef?: FfmpegEffectDefinition;
  categoryLabel?: string;
};

export type RecipeLeaf = {
  type: "recipe";
  id: string;
  recipe: FilterRecipe;
};

export type FolderNode = {
  type: "folder";
  id: string;
  label: string;
  children: Array<FolderNode | EffectLeaf | RecipeLeaf>;
};

export type TreeNode = FolderNode | EffectLeaf | RecipeLeaf;

export type CompactBadge = {
  kind: "missing" | "fallback" | "analyze" | "render-only" | "preview";
  label: string;
  title?: string;
};

const BADGE_PRIORITY: CompactBadge["kind"][] = [
  "missing",
  "fallback",
  "analyze",
  "render-only",
  "preview",
];

const SHOW_UNAVAILABLE_KEY = "ffmpeg-studio-show-unavailable-filters";

export function loadShowUnavailableFilters(): boolean {
  try {
    return localStorage.getItem(SHOW_UNAVAILABLE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveShowUnavailableFilters(value: boolean) {
  try {
    localStorage.setItem(SHOW_UNAVAILABLE_KEY, value ? "true" : "false");
  } catch {
    // ignore
  }
}

export function compactEffectBadges(
  def: FfmpegEffectDefinition | undefined,
  filtersAvailable: boolean,
  options?: { suppressUnavailable?: boolean }
): { visible: CompactBadge[]; hidden: CompactBadge[] } {
  if (!def) {
    return { visible: [], hidden: [] };
  }
  if (options?.suppressUnavailable && !filtersAvailable) {
    return { visible: [], hidden: [] };
  }
  const raw = getEffectBadges(def, filtersAvailable);
  const badges = partitionCompactBadges(raw);
  if (!filtersAvailable && def) {
    return {
      visible: badges.visible.map((badge) =>
        badge.kind === "missing"
          ? { ...badge, title: getEffectUnavailableTooltip(def) }
          : badge
      ),
      hidden: badges.hidden,
    };
  }
  return badges;
}

export function compactRecipeBadges(
  plan: RecipePlan,
  options?: { suppressUnavailable?: boolean }
): {
  visible: CompactBadge[];
  hidden: CompactBadge[];
} {
  if (options?.suppressUnavailable && plan.disabled) {
    return { visible: [], hidden: [] };
  }

  const raw: CompactBadge["kind"][] = [];
  if (plan.disabled) {
    raw.push("missing");
  } else if (plan.badges.includes("Fallback")) {
    raw.push("fallback");
  }
  if (plan.badges.includes("Requires analysis")) {
    raw.push("analyze");
  }
  if (plan.badges.includes("Render-only")) {
    raw.push("render-only");
  }

  const sorted = BADGE_PRIORITY.filter((kind) => raw.includes(kind)).map((kind) => ({
    kind,
    label: badgeShortLabel(kind),
    title:
      kind === "missing"
        ? plan.disabledReason ??
          "This FFmpeg filter is not available in your current FFmpeg build."
        : kind === "fallback"
          ? plan.fallbackNote
          : kind === "render-only"
            ? "Applied during render; live preview may not show this filter."
            : undefined,
  }));

  return {
    visible: sorted.slice(0, 2),
    hidden: sorted.slice(2),
  };
}

const EFFECT_BADGE_PRIORITY: EffectBadgeKind[] = [
  "missing",
  "analyze",
  "render-only",
  "preview",
];

function partitionCompactBadges(raw: EffectBadgeKind[]): {
  visible: CompactBadge[];
  hidden: CompactBadge[];
} {
  const sorted = EFFECT_BADGE_PRIORITY.filter((kind) => raw.includes(kind)).map((kind) => ({
    kind: kind as CompactBadge["kind"],
    label: badgeShortLabel(kind as CompactBadge["kind"]),
    title:
      kind === "render-only"
        ? "Applied during render; live preview may not show this filter."
        : undefined,
  }));
  return {
    visible: sorted.slice(0, 2),
    hidden: sorted.slice(2),
  };
}

export function badgeShortLabel(kind: CompactBadge["kind"]): string {
  switch (kind) {
    case "missing":
      return "Unavailable";
    case "fallback":
      return "Fallback";
    case "analyze":
      return "ANALYZE";
    case "render-only":
      return "Render-only";
    case "preview":
      return "PREVIEW";
  }
}

export function isRecipeVisible(
  recipe: FilterRecipe,
  availability: FfmpegFilterAvailability,
  showUnavailable: boolean
): boolean {
  const plan = buildRecipePlan(recipe, availability);
  if (!plan.disabled) {
    return true;
  }
  return showUnavailable;
}

export function isEffectNodeVisible(
  catalogDef: FfmpegEffectDefinition | undefined,
  isEffectAvailable: (def: FfmpegEffectDefinition) => boolean,
  showUnavailable: boolean
): boolean {
  if (!catalogDef) {
    return true;
  }
  if (isEffectAvailable(catalogDef)) {
    return true;
  }
  return showUnavailable;
}

export function filterTreeByAvailability(
  nodes: Array<TreeNode>,
  availability: FfmpegFilterAvailability,
  showUnavailable: boolean,
  isEffectAvailable: (def: FfmpegEffectDefinition) => boolean
): Array<TreeNode> {
  const result: Array<TreeNode> = [];

  for (const node of nodes) {
    if (node.type === "recipe") {
      if (isRecipeVisible(node.recipe, availability, showUnavailable)) {
        result.push(node);
      }
      continue;
    }
    if (node.type === "effect") {
      if (isEffectNodeVisible(node.catalogDef, isEffectAvailable, showUnavailable)) {
        result.push(node);
      }
      continue;
    }

    const filteredChildren = filterTreeByAvailability(
      node.children,
      availability,
      showUnavailable,
      isEffectAvailable
    );
    if (filteredChildren.length > 0) {
      result.push({ ...node, children: filteredChildren });
    }
  }

  return result;
}

export function recipeMatchesSearch(recipe: FilterRecipe, query: string): boolean {
  const haystack = [
    recipe.title,
    recipe.description,
    recipe.category,
    recipe.id,
    ...recipe.requiredFilters,
    ...(recipe.optionalFilters ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function effectMatchesSearch(
  label: string,
  effectType: string,
  catalogDef: FfmpegEffectDefinition | undefined,
  categoryLabel: string | undefined,
  query: string
): boolean {
  const haystack = [
    label,
    effectType,
    categoryLabel,
    catalogDef?.description,
    catalogDef?.category,
    catalogDef?.id,
    ...(catalogDef?.ffmpegFilters ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function recipeDetailsText(plan: RecipePlan): string {
  const parts = [plan.recipe.description];
  if (plan.fallbackNote) {
    parts.push(plan.fallbackNote);
  }
  if (plan.badges.includes("Requires analysis")) {
    parts.push("Requires analysis.");
  }
  if (plan.disabled && plan.disabledReason) {
    parts.push(plan.disabledReason);
  }
  return parts.filter(Boolean).join(" ");
}

export function effectDetailsText(
  label: string,
  catalogDef: FfmpegEffectDefinition | undefined
): string {
  if (catalogDef?.description) {
    return catalogDef.description;
  }
  return `Add ${label} to the selected layer.`;
}
