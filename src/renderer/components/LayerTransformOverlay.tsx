import { useCallback, useRef } from "react";
import type { LayerTransform } from "../../shared/transform";
import {
  compToDisplay,
  displayToComp,
  getCompCanvasLayout,
  getLayerBounds,
} from "../utils/layerTransform";

type LayerTransformOverlayProps = {
  transform: LayerTransform;
  compWidth: number;
  compHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  containerWidth: number;
  containerHeight: number;
  locked: boolean;
  uniformScale: boolean;
  onChange: (patch: Partial<LayerTransform>) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

type DragMode =
  | { type: "move"; startCompX: number; startCompY: number; origin: LayerTransform }
  | {
      type: "scale";
      handle: "nw" | "ne" | "sw" | "se";
      startDist: number;
      origin: LayerTransform;
    };

const HANDLES = ["nw", "ne", "sw", "se"] as const;

function getHandleCompPosition(
  handle: (typeof HANDLES)[number],
  bounds: ReturnType<typeof getLayerBounds>
): { x: number; y: number } {
  switch (handle) {
    case "nw":
      return { x: bounds.left, y: bounds.top };
    case "ne":
      return { x: bounds.left + bounds.width, y: bounds.top };
    case "sw":
      return { x: bounds.left, y: bounds.top + bounds.height };
    case "se":
      return { x: bounds.left + bounds.width, y: bounds.top + bounds.height };
  }
}

export default function LayerTransformOverlay({
  transform,
  compWidth,
  compHeight,
  sourceWidth,
  sourceHeight,
  containerWidth,
  containerHeight,
  locked,
  uniformScale,
  onChange,
  onDragStart,
  onDragEnd,
}: LayerTransformOverlayProps) {
  const dragRef = useRef<DragMode | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const layout = getCompCanvasLayout(containerWidth, containerHeight, compWidth, compHeight);
  const bounds = getLayerBounds(transform, sourceWidth, sourceHeight);
  const boxDisplay = {
    left: compToDisplay(bounds.left, bounds.top, layout).x,
    top: compToDisplay(bounds.left, bounds.top, layout).y,
    width: bounds.width * layout.scale,
    height: bounds.height * layout.scale,
  };

  const anchorDisplay = compToDisplay(transform.positionX, transform.positionY, layout);

  const startDrag = useCallback(
    (mode: DragMode, event: React.PointerEvent) => {
      if (locked) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = mode;
      onDragStart?.();

      const onMove = (e: PointerEvent) => {
        const drag = dragRef.current;
        const overlay = overlayRef.current;
        if (!drag || !overlay) {
          return;
        }

        const rect = overlay.getBoundingClientRect();
        const compPoint = displayToComp(
          e.clientX - rect.left,
          e.clientY - rect.top,
          layout
        );

        if (drag.type === "move") {
          const dx = compPoint.x - drag.startCompX;
          const dy = compPoint.y - drag.startCompY;
          onChange({
            positionX: drag.origin.positionX + dx,
            positionY: drag.origin.positionY + dy,
          });
          return;
        }

        const dist = Math.hypot(
          compPoint.x - drag.origin.positionX,
          compPoint.y - drag.origin.positionY
        );
        const ratio = drag.startDist > 0 ? dist / drag.startDist : 1;
        const nextScaleX = Math.max(1, drag.origin.scaleX * ratio);
        const nextScaleY = uniformScale || e.shiftKey
          ? nextScaleX
          : Math.max(1, drag.origin.scaleY * ratio);

        onChange({
          scaleX: nextScaleX,
          scaleY: nextScaleY,
        });
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        onDragEnd?.();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [layout, locked, onChange, uniformScale]
  );

  const onMovePointerDown = (event: React.PointerEvent) => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }
    const rect = overlay.getBoundingClientRect();
    const compPoint = displayToComp(
      event.clientX - rect.left,
      event.clientY - rect.top,
      layout
    );
    startDrag(
      {
        type: "move",
        startCompX: compPoint.x,
        startCompY: compPoint.y,
        origin: transform,
      },
      event
    );
  };

  const onScalePointerDown = (
    handle: (typeof HANDLES)[number],
    event: React.PointerEvent
  ) => {
    event.stopPropagation();
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }
    const rect = overlay.getBoundingClientRect();
    const compPoint = displayToComp(
      event.clientX - rect.left,
      event.clientY - rect.top,
      layout
    );
    const handlePos = getHandleCompPosition(handle, bounds);
    const startDist = Math.max(
      1,
      Math.hypot(handlePos.x - transform.positionX, handlePos.y - transform.positionY)
    );
    const pointerDist = Math.hypot(
      compPoint.x - transform.positionX,
      compPoint.y - transform.positionY
    );
    startDrag(
      {
        type: "scale",
        handle,
        startDist: pointerDist > 0 ? pointerDist : startDist,
        origin: transform,
      },
      event
    );
  };

  if (containerWidth <= 0 || containerHeight <= 0) {
    return null;
  }

  return (
    <div ref={overlayRef} className="layer-transform-overlay">
      <div
        className="comp-canvas-frame"
        style={{
          left: layout.offsetX,
          top: layout.offsetY,
          width: layout.renderWidth,
          height: layout.renderHeight,
        }}
      />

      <div
        className={`transform-box ${locked ? "locked" : ""}`}
        style={{
          left: boxDisplay.left,
          top: boxDisplay.top,
          width: boxDisplay.width,
          height: boxDisplay.height,
          transform: `rotate(${transform.rotation}deg)`,
          transformOrigin: `${transform.anchorX * 100}% ${transform.anchorY * 100}%`,
          opacity: transform.opacity / 100,
        }}
        onPointerDown={onMovePointerDown}
      >
        {!locked &&
          HANDLES.map((handle) => (
            <div
              key={handle}
              className={`transform-handle transform-handle-${handle}`}
              onPointerDown={(event) => onScalePointerDown(handle, event)}
            />
          ))}
      </div>

      <div
        className="transform-anchor"
        style={{
          left: anchorDisplay.x - 4,
          top: anchorDisplay.y - 4,
        }}
      />
    </div>
  );
}
