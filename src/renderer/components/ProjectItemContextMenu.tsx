import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProjectItem } from "../../shared/project";
export type ProjectItemContextMenuState = {
  x: number;
  y: number;
  item: ProjectItem;
} | null;

type ProjectItemContextMenuProps = {
  menu: ProjectItemContextMenuState;
  activeCompositionId?: string | null;
  compositionCount: number;
  onClose: () => void;
  onCompositionSettings?: (itemId: string) => void;
  onRenameComposition?: (itemId: string) => void;
  onDuplicateComposition?: (itemId: string) => void;
  onDeleteComposition?: (itemId: string) => void;
  onOpenComposition?: (itemId: string) => void;
  onRetryChromiumPreview?: (itemId: string) => void;
};

export default function ProjectItemContextMenu({
  menu,
  activeCompositionId = null,
  compositionCount,
  onClose,
  onCompositionSettings,
  onRenameComposition,
  onDuplicateComposition,
  onDeleteComposition,
  onOpenComposition,
  onRetryChromiumPreview,
}: ProjectItemContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!menu || !ref.current) {
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const margin = 8;
    let left = menu.x;
    let top = menu.y;
    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, menu.x - rect.width);
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, menu.y - rect.height);
    }
    setPosition({ left, top });
  }, [menu]);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menu, onClose]);

  if (!menu) {
    return null;
  }

  const { item } = menu;
  const isComposition = item.type === "composition";
  const canDelete = isComposition && compositionCount > 1;
  const isActiveComp = isComposition && item.id === activeCompositionId;
  const showRetryChromium = false;

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      className="project-item-context-menu"
      style={{ left: position.left, top: position.top }}
      role="menu"
    >
      {isComposition && (
        <>
          <button
            type="button"
            className="project-item-context-menu-item"
            role="menuitem"
            onClick={() => run(() => onCompositionSettings?.(item.id))}
          >
            Composition Settings
          </button>
          <button
            type="button"
            className="project-item-context-menu-item"
            role="menuitem"
            onClick={() => run(() => onRenameComposition?.(item.id))}
          >
            Rename
          </button>
          <button
            type="button"
            className="project-item-context-menu-item"
            role="menuitem"
            onClick={() => run(() => onDuplicateComposition?.(item.id))}
          >
            Duplicate
          </button>
          {onOpenComposition && !isActiveComp && (
            <button
              type="button"
              className="project-item-context-menu-item"
              role="menuitem"
              onClick={() => run(() => onOpenComposition(item.id))}
            >
              Open
            </button>
          )}
          <div className="project-item-context-menu-divider" />
          <button
            type="button"
            className="project-item-context-menu-item project-item-context-menu-item-danger"
            role="menuitem"
            disabled={!canDelete}
            onClick={() => {
              if (canDelete) {
                run(() => onDeleteComposition?.(item.id));
              }
            }}
          >
            Delete
          </button>
        </>
      )}
      {showRetryChromium && (
        <button
          type="button"
          className="project-item-context-menu-item"
          role="menuitem"
          onClick={() => run(() => onRetryChromiumPreview?.(item.id))}
        >
          Retry Chromium Preview
        </button>
      )}
    </div>,
    document.body
  );
}
