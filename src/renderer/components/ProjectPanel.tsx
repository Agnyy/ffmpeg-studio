import { memo, useMemo, useState } from "react";
import ProjectItemContextMenu, {
  type ProjectItemContextMenuState,
} from "./ProjectItemContextMenu";
import { useRenderCount } from "../hooks/useRenderCount";
import type { ProjectItem } from "../../shared/project";
import { mediaStatusLabel } from "../../media/thumbnailStatus";
import ProjectBatchActionsMenu from "./ProjectBatchActionsMenu";
import ProjectItemThumbnail from "./ProjectItemThumbnail";
import CompositionIcon from "./CompositionIcon";
import { formatDuration, formatResolution } from "../utils/format";
import { extractDroppedPaths, preventDragDefaults } from "../utils/dnd";

export type ProjectItemSelectModifiers = {
  ctrlKey: boolean;
  shiftKey: boolean;
  visibleItemIds: string[];
};

type ProjectPanelProps = {
  embedded?: boolean;
  items: ProjectItem[];
  selectedItemId: string | null;
  selectedItemIds: string[];
  activeCompositionId?: string | null;
  importError: string | null;
  proxyGeneratingIds: Set<string>;
  onImportMedia: () => void;
  onNewComposition?: () => void;
  onCompositionSettings?: (itemId: string) => void;
  onDuplicateComposition?: (itemId: string) => void;
  onDeleteComposition?: (itemId: string) => void;
  onRenameComposition?: (itemId: string) => void;
  onOpenComposition?: (itemId: string) => void;
  onSelectItem: (itemId: string, modifiers: ProjectItemSelectModifiers) => void;
  onItemDoubleClick?: (itemId: string) => void;
  onDropPaths: (paths: string[]) => void;
  onRelinkMedia: (itemId: string) => void;
  onCreatePreviewProxy: (itemId: string) => void;
  onRetryChromiumPreview?: (itemId: string) => void;
  onBatchApplyPreset?: () => void;
  onBatchCreateProxies?: () => void;
  onBatchAddToQueue?: () => void;
};

function footageMeta(item: ProjectItem): string {
  const info = item.mediaInfo;
  if (!info) {
    return "Probing…";
  }
  const parts = [
    formatDuration(info.durationSeconds),
    formatResolution(info.width, info.height),
    info.videoCodec,
  ].filter(Boolean);
  return parts.join(" · ");
}

function footageInfo(item: ProjectItem): string {
  if (item.missing) {
    return "Missing";
  }
  const info = item.mediaInfo;
  if (!info) {
    return "Probing…";
  }
  const parts = [
    formatDuration(info.durationSeconds),
    formatResolution(info.width, info.height),
    info.videoCodec,
  ].filter(Boolean);
  return parts.join(" · ");
}

function compositionInfo(item: ProjectItem): string {
  const comp = item.composition;
  if (!comp) {
    return "Composition";
  }
  return `${comp.width}x${comp.height} · ${Math.round(comp.fps)}fps · ${formatDuration(comp.duration)}`;
}

function itemTypeLabel(item: ProjectItem): string {
  return item.type === "footage" ? "Footage" : "Composition";
}

function ProjectItemInfo({
  item,
  selectedCount,
}: {
  item: ProjectItem | null;
  selectedCount: number;
}) {
  if (selectedCount > 1) {
    return (
      <div className="project-item-info">
        <div className="project-item-info-body">
          <div className="project-item-info-name">{selectedCount} items selected</div>
          <div className="project-item-info-meta">Use Batch Actions or Export → Batch Export.</div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="project-item-info project-item-info-empty">
        <span className="project-item-info-placeholder">No item selected</span>
      </div>
    );
  }

  if (item.type === "footage") {
    if (item.missing) {
      return (
        <div className="project-item-info project-item-info-missing">
          <div className="project-item-info-thumb project-item-info-thumb-media">
            <ProjectItemThumbnail item={item} />
          </div>
          <div className="project-item-info-body">
            <div className="project-item-info-name">{item.name}</div>
            <div className="project-item-info-type">Footage · Missing Media</div>
            <div className="project-item-info-meta">{item.originalPath ?? item.path ?? "Unknown path"}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="project-item-info">
        <div className="project-item-info-thumb project-item-info-thumb-media">
          <ProjectItemThumbnail item={item} />
        </div>
        <div className="project-item-info-body">
          <div className="project-item-info-name">{item.name}</div>
          <div className="project-item-info-type">Footage</div>
          <div className="project-item-info-meta">{footageMeta(item)}</div>
          <div className="project-item-info-status">{mediaStatusLabel(item)}</div>
        </div>
      </div>
    );
  }

  if (item.type === "composition") {
    const comp = item.composition;
    const meta = comp
      ? `${comp.width}x${comp.height} · ${Math.round(comp.fps)}fps · ${formatDuration(comp.duration)}`
      : "Composition";
    return (
      <div className="project-item-info">
        <div className="project-item-info-thumb">
          <ProjectItemThumbnail item={item} />
        </div>
        <div className="project-item-info-body">
          <div className="project-item-info-name">{item.name}</div>
          <div className="project-item-info-type">Composition</div>
          <div className="project-item-info-meta">{meta}</div>
        </div>
      </div>
    );
  }

  return null;
}

function ProjectPanel({
  embedded = false,
  items,
  selectedItemId,
  selectedItemIds,
  activeCompositionId = null,
  importError,
  proxyGeneratingIds: _proxyGeneratingIds,
  onImportMedia,
  onNewComposition,
  onCompositionSettings,
  onDuplicateComposition,
  onDeleteComposition,
  onRenameComposition,
  onOpenComposition,
  onSelectItem,
  onItemDoubleClick,
  onDropPaths,
  onRelinkMedia,
  onCreatePreviewProxy,
  onRetryChromiumPreview,
  onBatchApplyPreset,
  onBatchCreateProxies: _onBatchCreateProxies,
  onBatchAddToQueue,
}: ProjectPanelProps) {
  useRenderCount("ProjectPanel");

  const [search, setSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<ProjectItemContextMenuState>(null);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const selectedFootageCount = useMemo(
    () =>
      selectedItemIds.filter((id) => {
        const item = items.find((entry) => entry.id === id);
        return item?.type === "footage" && !item.missing && item.path;
      }).length,
    [items, selectedItemIds]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, search]);

  const visibleItemIds = useMemo(
    () => filteredItems.map((item) => item.id),
    [filteredItems]
  );

  const handleDrop = (event: React.DragEvent) => {
    preventDragDefaults(event);
    const paths = extractDroppedPaths(event);
    if (paths.length > 0) {
      onDropPaths(paths);
    }
  };

  const handleRowDoubleClick = (item: ProjectItem) => {
    onSelectItem(item.id, { ctrlKey: false, shiftKey: false, visibleItemIds });
    onItemDoubleClick?.(item.id);
  };

  const handleRowClick = (item: ProjectItem, event: React.MouseEvent) => {
    onSelectItem(item.id, {
      ctrlKey: event.ctrlKey || event.metaKey,
      shiftKey: event.shiftKey,
      visibleItemIds,
    });
  };

  return (
    <aside className={`project-panel ${embedded ? "project-panel-embedded" : ""}`}>
      {!embedded && (
        <div className="project-panel-titlebar">
          <h2 className="project-panel-title">Project</h2>
        </div>
      )}

      <>
        <ProjectItemInfo
          item={selectedItem}
          selectedCount={selectedFootageCount > 1 ? selectedFootageCount : 0}
        />

        <ProjectBatchActionsMenu
          selectedCount={selectedFootageCount}
          onApplyPreset={() => onBatchApplyPreset?.()}
          onAddToQueue={() => onBatchAddToQueue?.()}
        />

        <div className="project-search-wrap">
          <input
            type="text"
            className="project-search"
            placeholder="Search project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {importError && <div className="project-import-error">{importError}</div>}

        <div
          className="project-table-wrap"
          onDragOver={preventDragDefaults}
          onDrop={handleDrop}
        >
          <div className="project-table-head">
            <span>Name</span>
            <span>Type</span>
            <span>Info</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="project-empty-row">Drop video files here</div>
          ) : (
            filteredItems.map((item) => {
              const showProxyBtn = false;
              const isSelected = selectedItemIds.includes(item.id);
              const isActiveComp =
                item.type === "composition" && item.id === activeCompositionId;
              return (
                <div
                  key={item.id}
                  data-project-item-id={item.id}
                  className={`project-row-wrap ${isSelected ? "selected" : ""} ${
                    isActiveComp ? "active-composition" : ""
                  }`}
                >
                  <button
                    type="button"
                    className={`project-row ${item.missing ? "missing-media" : ""} ${
                      showProxyBtn ? "project-row-proxy-needed" : ""
                    }`}
                    onClick={(event) => handleRowClick(item, event)}
                    onDoubleClick={() => handleRowDoubleClick(item)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({ x: event.clientX, y: event.clientY, item });
                    }}
                  >
                    <span className="project-row-name project-row-name-with-thumb">
                      <span className="project-row-thumb">
                        <ProjectItemThumbnail item={item} size="sm" />
                      </span>
                      {item.missing ? "⚠ " : showProxyBtn ? "⚠ " : ""}
                      {item.name}
                    </span>
                    <span className="project-row-type">{itemTypeLabel(item)}</span>
                    <span className="project-row-info">
                      {item.type === "footage"
                        ? footageInfo(item)
                        : compositionInfo(item)}
                    </span>
                  </button>
                  {item.missing && item.type === "footage" && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm project-relink-btn"
                      onClick={() => onRelinkMedia(item.id)}
                    >
                      Relink
                    </button>
                  )}
                  {showProxyBtn && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm project-proxy-btn"
                      onClick={() => onCreatePreviewProxy(item.id)}
                    >
                      Create Proxy
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="project-bottom-toolbar">
          <button
            type="button"
            className="project-icon-btn"
            onClick={onImportMedia}
            title="Import footage"
          >
            +
          </button>
          <button type="button" className="project-icon-btn" disabled title="New folder">
            📁
          </button>
          <button
            type="button"
            className="project-icon-btn project-icon-btn-comp"
            onClick={() => onNewComposition?.()}
            title="New Comp"
          >
            <CompositionIcon size={16} />
          </button>
          <button
            type="button"
            className="project-icon-btn"
            title="Delete composition"
            disabled={
              !selectedItem ||
              selectedItem.type !== "composition" ||
              items.filter((entry) => entry.type === "composition").length <= 1
            }
            onClick={() => {
              if (selectedItem?.type === "composition") {
                onDeleteComposition?.(selectedItem.id);
              }
            }}
          >
            🗑
          </button>
        </div>

        <ProjectItemContextMenu
          menu={contextMenu}
          activeCompositionId={activeCompositionId}
          compositionCount={items.filter((entry) => entry.type === "composition").length}
          onClose={() => setContextMenu(null)}
          onCompositionSettings={onCompositionSettings}
          onRenameComposition={onRenameComposition}
          onDuplicateComposition={onDuplicateComposition}
          onDeleteComposition={onDeleteComposition}
          onOpenComposition={onOpenComposition}
          onRetryChromiumPreview={onRetryChromiumPreview}
        />
      </>
    </aside>
  );
}

export default memo(ProjectPanel);
