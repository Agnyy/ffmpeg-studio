import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ALL_INTERPOLATIONS, INTERPOLATION_LABELS } from "../../keyframes/keyframeInterpolation";
import type { KeyframeInterpolation } from "../../keyframes/keyframeTypes";

export type KeyframeContextMenuState = {
  x: number;
  y: number;
} | null;

type KeyframeContextMenuProps = {
  menu: KeyframeContextMenuState;
  onClose: () => void;
  onSetInterpolation: (interpolation: KeyframeInterpolation) => void;
  onDelete: () => void;
  onCopy: () => void;
};

export default function KeyframeContextMenu({
  menu,
  onClose,
  onSetInterpolation,
  onDelete,
  onCopy,
}: KeyframeContextMenuProps) {
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

  return createPortal(
    <div
      ref={ref}
      className="keyframe-context-menu"
      style={{ left: position.left, top: position.top }}
      role="menu"
    >
      <div className="keyframe-context-menu-section" role="group" aria-label="Keyframe Interpolation">
        <span className="keyframe-context-menu-heading">Keyframe Interpolation</span>
        {ALL_INTERPOLATIONS.map((interpolation) => (
          <button
            key={interpolation}
            type="button"
            className="keyframe-context-menu-item"
            role="menuitem"
            onClick={() => {
              onSetInterpolation(interpolation);
              onClose();
            }}
          >
            {INTERPOLATION_LABELS[interpolation]}
          </button>
        ))}
      </div>
      <div className="keyframe-context-menu-divider" />
      <button
        type="button"
        className="keyframe-context-menu-item"
        role="menuitem"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        Delete Keyframe
      </button>
      <button
        type="button"
        className="keyframe-context-menu-item"
        role="menuitem"
        onClick={() => {
          onCopy();
          onClose();
        }}
      >
        Copy Keyframe
      </button>
    </div>,
    document.body
  );
}
