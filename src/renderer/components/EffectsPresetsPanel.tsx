import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRenderCount } from "../hooks/useRenderCount";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Search,
  MoreHorizontal,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  EFFECT_MENU_GROUPS,
  type LayerEffectType,
} from "../../shared/effects";
import {
  FFMPEG_EFFECT_CATEGORIES,
  FFMPEG_EFFECT_CATALOG,
  getEffectUnavailableTooltip,
  type FfmpegEffectDefinition,
} from "../../effects/ffmpegEffectCatalog";
import {
  FILTER_RECIPE_CATEGORIES,
  FILTER_RECIPES,
  type FilterRecipe,
} from "../../effects/filterRecipes";
import { buildRecipePlan } from "../../effects/applyFilterRecipe";
import type { TimelineLayer } from "../../shared/project";
import { useEffectsTreeExpansion } from "../hooks/useEffectsTreeExpansion";
import { useFfmpegFilters } from "../hooks/useFfmpegFilters";
import ApplyRecipeDialog from "./ApplyRecipeDialog";
import EffectPresetInfoPopover from "./EffectPresetInfoPopover";
import EffectPresetRow from "./EffectPresetRow";
import StartupPreparingBanner from "./StartupPreparingBanner";
import {
  compactEffectBadges,
  compactRecipeBadges,
  effectDetailsText,
  effectMatchesSearch,
  filterTreeByAvailability,
  loadShowUnavailableFilters,
  recipeDetailsText,
  recipeMatchesSearch,
  saveShowUnavailableFilters,
  type EffectLeaf,
  type FolderNode,
  type RecipeLeaf,
} from "./effectPresetRowUtils";

type EffectsPresetsPanelProps = {
  selectedLayer: TimelineLayer | null;
  ffmpegChecking?: boolean;
  ffmpegError?: string | null;
  onAddEffect: (type: LayerEffectType) => void;
  onApplyRecipe: (recipeId: string, options?: { strength?: string }) => void;
  onHint?: (message: string) => void;
};

type FlatRow = {
  rowId: string;
  node: EffectLeaf | RecipeLeaf;
  depth: number;
};

type InfoPopoverState = {
  rowId: string;
  anchorRect: DOMRect;
  type: "recipe" | "effect";
  name: string;
  recipe?: FilterRecipe;
  plan?: ReturnType<typeof buildRecipePlan>;
  catalogDef?: FfmpegEffectDefinition;
  hiddenBadges?: import("./effectPresetRowUtils").CompactBadge[];
};

function buildSmartPresetsTree(): FolderNode {
  const categoryFolders: FolderNode[] = FILTER_RECIPE_CATEGORIES.map((category) => ({
    type: "folder" as const,
    id: `smart-${category.toLowerCase().replace(/\s+/g, "-")}`,
    label: category,
    children: FILTER_RECIPES.filter((recipe) => recipe.category === category).map(
      (recipe) => ({
        type: "recipe" as const,
        id: recipe.id,
        recipe,
      })
    ),
  }));

  return {
    type: "folder",
    id: "smart-presets",
    label: "Smart Presets",
    children: categoryFolders,
  };
}

function buildFfmpegFiltersTree(): FolderNode {
  const catalogNodes: FolderNode[] = FFMPEG_EFFECT_CATEGORIES.map((category) => ({
    type: "folder" as const,
    id: category.toLowerCase().replace(/\s+/g, "-"),
    label: category,
    children: FFMPEG_EFFECT_CATALOG.filter((entry) => entry.category === category).map(
      (entry) => ({
        type: "effect" as const,
        id: entry.id,
        label: entry.name,
        effectType: entry.id as LayerEffectType,
        catalogDef: entry,
        categoryLabel: category,
      })
    ),
  }));

  const legacyNodes: FolderNode[] = EFFECT_MENU_GROUPS.map((group) => ({
    type: "folder" as const,
    id: `legacy-${group.label.toLowerCase().replace(/\s+/g, "-")}`,
    label: `${group.label} (Built-in)`,
    children: group.items.map((item) => ({
      type: "effect" as const,
      id: item.type,
      label: item.label,
      effectType: item.type,
      categoryLabel: group.label,
    })),
  }));

  return {
    type: "folder",
    id: "ffmpeg-filters",
    label: "FFmpeg Filters",
    children: [...catalogNodes, ...legacyNodes],
  };
}

const EFFECTS_TREE: FolderNode[] = [buildSmartPresetsTree(), buildFfmpegFiltersTree()];

function filterTree(
  nodes: Array<FolderNode | EffectLeaf | RecipeLeaf>,
  query: string
): Array<FolderNode | EffectLeaf | RecipeLeaf> {
  if (!query) {
    return nodes;
  }

  const result: Array<FolderNode | EffectLeaf | RecipeLeaf> = [];
  for (const node of nodes) {
    if (node.type === "effect") {
      if (
        effectMatchesSearch(
          node.label,
          node.effectType,
          node.catalogDef,
          node.categoryLabel,
          query
        )
      ) {
        result.push(node);
      }
      continue;
    }
    if (node.type === "recipe") {
      if (recipeMatchesSearch(node.recipe, query)) {
        result.push(node);
      }
      continue;
    }

    const folderMatches = node.label.toLowerCase().includes(query);
    const filteredChildren = filterTree(node.children, query);
    if (folderMatches || filteredChildren.length > 0) {
      result.push({ ...node, children: filteredChildren });
    }
  }
  return result;
}

function collectFolderIds(nodes: Array<FolderNode | EffectLeaf | RecipeLeaf>): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      ids.push(node.id);
      ids.push(...collectFolderIds(node.children));
    }
  }
  return ids;
}

function flattenVisibleRows(
  nodes: Array<FolderNode | EffectLeaf | RecipeLeaf>,
  expanded: Set<string>,
  depth = 0
): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const node of nodes) {
    if (node.type === "effect" || node.type === "recipe") {
      rows.push({ rowId: node.id, node, depth });
      continue;
    }
    if (expanded.has(node.id)) {
      rows.push(...flattenVisibleRows(node.children, expanded, depth + 1));
    }
  }
  return rows;
}

function EffectsPresetsPanel({
  selectedLayer,
  ffmpegChecking = false,
  ffmpegError = null,
  onAddEffect,
  onApplyRecipe,
  onHint,
}: EffectsPresetsPanelProps) {
  useRenderCount("EffectsPresetsPanel");

  const [search, setSearch] = useState("");
  const { savedExpanded, toggleFolder, resetFolders } = useEffectsTreeExpansion();
  const [showUnavailable, setShowUnavailable] = useState(loadShowUnavailableFilters);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [infoPopover, setInfoPopover] = useState<InfoPopoverState | null>(null);
  const [detailsCollapsed, setDetailsCollapsed] = useState(true);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const [pendingPlan, setPendingPlan] = useState<ReturnType<typeof buildRecipePlan> | null>(
    null
  );
  const treeRef = useRef<HTMLDivElement>(null);
  const { availableNames, isEffectAvailable, loading, error } = useFfmpegFilters();

  const availability = useMemo(
    () => ({
      hasFilter: (name: string) => availableNames.has(name),
    }),
    [availableNames]
  );

  const filtersPreparing = loading || ffmpegChecking;
  const effectiveShowUnavailable = filtersPreparing ? false : showUnavailable;

  const query = search.trim().toLowerCase();
  const searchedTree = useMemo(() => filterTree(EFFECTS_TREE, query), [query]);
  const filteredTree = useMemo(
    () =>
      filterTreeByAvailability(
        searchedTree,
        availability,
        effectiveShowUnavailable,
        isEffectAvailable
      ),
    [searchedTree, availability, effectiveShowUnavailable, isEffectAvailable]
  );

  const effectiveExpanded = useMemo(() => {
    if (!query) {
      return savedExpanded;
    }
    return new Set(collectFolderIds(filteredTree));
  }, [savedExpanded, filteredTree, query]);

  const flatRows = useMemo(
    () => flattenVisibleRows(filteredTree, effectiveExpanded),
    [filteredTree, effectiveExpanded]
  );

  const handleShowUnavailableChange = (checked: boolean) => {
    setShowUnavailable(checked);
    saveShowUnavailableFilters(checked);
  };

  useEffect(() => {
    if (!optionsMenuOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (
        optionsMenuRef.current &&
        !optionsMenuRef.current.contains(event.target as Node)
      ) {
        setOptionsMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [optionsMenuOpen]);

  const handleAdd = useCallback(
    (type: LayerEffectType, catalogDef?: FfmpegEffectDefinition) => {
      if (!selectedLayer) {
        onHint?.("Select a layer first");
        return;
      }
      if (catalogDef && !isEffectAvailable(catalogDef)) {
        onHint?.(
          getEffectUnavailableTooltip(catalogDef) ||
            "This filter is not available in current FFmpeg build."
        );
        return;
      }
      onAddEffect(type);
    },
    [isEffectAvailable, onAddEffect, onHint, selectedLayer]
  );

  const handleRecipeApply = useCallback(
    (recipe: FilterRecipe) => {
      const plan = buildRecipePlan(recipe, availability);
      if (plan.disabled) {
        onHint?.(
          plan.disabledReason ?? "This filter is not available in current FFmpeg build."
        );
        return;
      }
      if (plan.requiresLayer && !selectedLayer) {
        onHint?.("Select a layer first");
        return;
      }
      setPendingPlan(plan);
    },
    [availability, onHint, selectedLayer]
  );

  const applyRow = useCallback(
    (row: FlatRow) => {
      if (row.node.type === "recipe") {
        handleRecipeApply(row.node.recipe);
        return;
      }
      const { effectType, catalogDef } = row.node;
      const disabled = Boolean(catalogDef && !isEffectAvailable(catalogDef));
      if (disabled) {
        onHint?.(
          catalogDef
            ? getEffectUnavailableTooltip(catalogDef)
            : "This filter is not available in current FFmpeg build."
        );
        return;
      }
      handleAdd(effectType, catalogDef);
    },
    [handleAdd, handleRecipeApply, isEffectAvailable, onHint]
  );

  const selectedFlatRow = flatRows.find((row) => row.rowId === selectedRowId) ?? null;

  const detailsContent = useMemo(() => {
    if (!selectedFlatRow) {
      return {
        title: "Details",
        body: "Select an effect or preset to see details.",
      };
    }
    if (selectedFlatRow.node.type === "recipe") {
      const plan = buildRecipePlan(selectedFlatRow.node.recipe, availability);
      return {
        title: selectedFlatRow.node.recipe.title,
        body: recipeDetailsText(plan),
      };
    }
    return {
      title: selectedFlatRow.node.label,
      body: effectDetailsText(selectedFlatRow.node.label, selectedFlatRow.node.catalogDef),
    };
  }, [availability, selectedFlatRow]);

  useEffect(() => {
    if (selectedRowId && !flatRows.some((row) => row.rowId === selectedRowId)) {
      setSelectedRowId(flatRows[0]?.rowId ?? null);
    }
  }, [flatRows, selectedRowId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!treeRef.current?.contains(document.activeElement) && document.activeElement !== treeRef.current) {
        return;
      }

      if (event.key === "Escape") {
        setInfoPopover(null);
        return;
      }

      if (flatRows.length === 0) {
        return;
      }

      const currentIndex = selectedRowId
        ? flatRows.findIndex((row) => row.rowId === selectedRowId)
        : -1;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = currentIndex < flatRows.length - 1 ? currentIndex + 1 : 0;
        setSelectedRowId(flatRows[next].rowId);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : flatRows.length - 1;
        setSelectedRowId(flatRows[prev].rowId);
        return;
      }

      if (event.key === "Enter" && currentIndex >= 0) {
        event.preventDefault();
        applyRow(flatRows[currentIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [applyRow, flatRows, selectedRowId]);

  const openInfo = (
    row: FlatRow,
    anchor: HTMLElement,
    badgeInfo: ReturnType<typeof compactRecipeBadges> | ReturnType<typeof compactEffectBadges>
  ) => {
    if (row.node.type === "recipe") {
      const plan = buildRecipePlan(row.node.recipe, availability);
      setInfoPopover({
        rowId: row.rowId,
        anchorRect: anchor.getBoundingClientRect(),
        type: "recipe",
        name: row.node.recipe.title,
        recipe: row.node.recipe,
        plan,
        hiddenBadges: badgeInfo.hidden,
      });
      return;
    }

    setInfoPopover({
      rowId: row.rowId,
      anchorRect: anchor.getBoundingClientRect(),
      type: "effect",
      name: row.node.label,
      catalogDef: row.node.catalogDef,
      hiddenBadges: badgeInfo.hidden,
    });
  };

  const renderNode = (node: FolderNode | EffectLeaf | RecipeLeaf, depth = 0): ReactNode => {
    if (node.type === "recipe") {
      const plan = buildRecipePlan(node.recipe, availability);
      const badgeInfo = compactRecipeBadges(plan, {
        suppressUnavailable: filtersPreparing,
      });
      const row: FlatRow = { rowId: node.id, node, depth };

      return (
        <EffectPresetRow
          key={node.id}
          rowId={node.id}
          icon={<Sparkles size={12} />}
          name={node.recipe.title}
          type="recipe"
          badges={badgeInfo.visible}
          disabled={plan.disabled}
          selected={selectedRowId === node.id}
          depth={depth}
          title={node.recipe.title}
          onSelect={() => setSelectedRowId(node.id)}
          onApply={() => handleRecipeApply(node.recipe)}
          onInfo={(anchor) => openInfo(row, anchor, compactRecipeBadges(plan))}
        />
      );
    }

    if (node.type === "effect") {
      const disabled = Boolean(node.catalogDef && !isEffectAvailable(node.catalogDef));
      const badgeInfo = compactEffectBadges(
        node.catalogDef,
        node.catalogDef ? isEffectAvailable(node.catalogDef) : true,
        { suppressUnavailable: filtersPreparing }
      );
      const row: FlatRow = { rowId: node.id, node, depth };

      return (
        <EffectPresetRow
          key={node.id}
          rowId={node.id}
          icon={<SlidersHorizontal size={12} />}
          name={node.label}
          type="effect"
          badges={badgeInfo.visible}
          disabled={disabled}
          selected={selectedRowId === node.id}
          depth={depth}
          title={node.label}
          onSelect={() => setSelectedRowId(node.id)}
          onApply={() => handleAdd(node.effectType, node.catalogDef)}
          onInfo={(anchor) => openInfo(row, anchor, badgeInfo)}
        />
      );
    }

    const isExpanded = effectiveExpanded.has(node.id);
    const hasChildren = node.children.length > 0;
    const isRootSection = node.id === "smart-presets" || node.id === "ffmpeg-filters";

    return (
      <div key={node.id} className="effects-tree-folder-group">
        <button
          type="button"
          className={`effects-tree-folder ${isRootSection ? "effects-tree-folder-root" : ""}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => hasChildren && toggleFolder(node.id)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={12} className="effects-tree-chevron" />
            ) : (
              <ChevronRight size={12} className="effects-tree-chevron" />
            )
          ) : (
            <span className="effects-tree-chevron-spacer" />
          )}
          {isExpanded ? (
            <FolderOpen size={13} className="effects-tree-folder-icon" />
          ) : (
            <Folder size={13} className="effects-tree-folder-icon" />
          )}
          <span className="effects-tree-folder-label">{node.label}</span>
        </button>
        {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="effects-presets-panel">
      <div className="effects-presets-search-row">
        <div className="effects-presets-search">
          <Search size={14} className="effects-presets-search-icon" />
          <input
            type="search"
            placeholder="Search presets and effects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="effects-presets-options" ref={optionsMenuRef}>
          <button
            type="button"
            className="effects-presets-options-btn"
            title="Panel options"
            aria-label="Panel options"
            aria-expanded={optionsMenuOpen}
            onClick={() => setOptionsMenuOpen((prev) => !prev)}
          >
            <MoreHorizontal size={16} />
          </button>
          {optionsMenuOpen && (
            <div className="effects-presets-options-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                disabled={filtersPreparing}
                onClick={() => {
                  handleShowUnavailableChange(!showUnavailable);
                  setOptionsMenuOpen(false);
                }}
              >
                {showUnavailable ? "Hide unavailable filters" : "Show unavailable filters"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDetailsCollapsed((prev) => !prev);
                  setOptionsMenuOpen(false);
                }}
              >
                {detailsCollapsed ? "Show details" : "Hide details"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  resetFolders();
                  onHint?.("Effect folders reset");
                  setOptionsMenuOpen(false);
                }}
              >
                Reset folders
              </button>
            </div>
          )}
        </div>
      </div>

      {!selectedLayer && !filtersPreparing && (
        <p className="effects-presets-layer-hint">Select a layer to apply filters.</p>
      )}

      <div className="effects-presets-tree-wrap">
        {(filtersPreparing || ffmpegError) && (
          <StartupPreparingBanner
            compact
            filtersLoading={loading}
            ffmpegChecking={ffmpegChecking}
            ffmpegError={ffmpegError ?? error}
          />
        )}

        <div
          ref={treeRef}
          className={`effects-presets-tree ${filtersPreparing ? "effects-presets-tree-loading" : ""}`}
          tabIndex={0}
          aria-label="Effects and presets"
        >
          {!filtersPreparing && filteredTree.map((node) => renderNode(node))}
          {!filtersPreparing && filteredTree.length === 0 && (
            <p className="effects-presets-empty">
              {query
                ? "No presets or effects match your search."
                : "No available presets or effects."}
            </p>
          )}
        </div>
      </div>

      {!detailsCollapsed && (
        <div className="effects-presets-details-body">
          {selectedFlatRow && <strong>{detailsContent.title}</strong>}
          <p>{detailsContent.body}</p>
        </div>
      )}

      {infoPopover && (
        <EffectPresetInfoPopover
          anchorRect={infoPopover.anchorRect}
          type={infoPopover.type}
          name={infoPopover.name}
          recipe={infoPopover.recipe}
          plan={infoPopover.plan}
          catalogDef={infoPopover.catalogDef}
          hiddenBadges={infoPopover.hiddenBadges}
          onClose={() => setInfoPopover(null)}
        />
      )}

      {pendingPlan && (
        <ApplyRecipeDialog
          plan={pendingPlan}
          showDeshakeStrength={pendingPlan.recipe.id === "quick-deshake"}
          onCancel={() => setPendingPlan(null)}
          onApply={(options) => {
            onApplyRecipe(pendingPlan.recipe.id, options);
            setPendingPlan(null);
          }}
        />
      )}
    </div>
  );
}

export default memo(EffectsPresetsPanel);
