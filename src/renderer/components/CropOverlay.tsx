import { useCallback, useRef, useState } from "react";
import type { CropAspectRatio, CropRect } from "../../shared/clipEdit";
import {
  aspectRatioValue,
  clampCropToVideo,
  getVideoContentRect,
  videoToDisplayRect,
} from "../utils/cropCoords";

type CropOverlayProps = {
  crop: CropRect;
  cropEnabled: boolean;
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
  aspectRatio: CropAspectRatio;
  onChange: (crop: CropRect) => void;
};

type DragMode =
  | { type: "move"; startX: number; startY: number; origin: CropRect }
  | {
      type: "resize";
      handle: string;
      startX: number;
      startY: number;
      origin: CropRect;
    };

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

export default function CropOverlay({
  crop,
  cropEnabled,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight,
  aspectRatio,
  onChange,
}: CropOverlayProps) {
  const dragRef = useRef<DragMode | null>(null);
  const [, forceRender] = useState(0);

  const content = getVideoContentRect(
    videoWidth,
    videoHeight,
    containerWidth,
    containerHeight
  );

  const displayRect = videoToDisplayRect(crop, content, videoWidth, videoHeight);

  const applyCrop = useCallback(
    (next: CropRect) => {
      onChange(clampCropToVideo(next, videoWidth, videoHeight));
    },
    [onChange, videoWidth, videoHeight]
  );

  const pointerToDisplay = (clientX: number, clientY: number, rect: DOMRect) => ({
    x: clientX - rect.left,
    y: clientY - rect.top,
  });

  const onPointerMove = useCallback(
    (event: PointerEvent, overlayRect: DOMRect) => {
      const mode = dragRef.current;
      if (!mode) {
        return;
      }

      const pointer = pointerToDisplay(event.clientX, event.clientY, overlayRect);
      const dx = (pointer.x - mode.startX) * (videoWidth / content.renderWidth);
      const dy = (pointer.y - mode.startY) * (videoHeight / content.renderHeight);
      const lockAspect =
        event.shiftKey ||
        (aspectRatio !== "free" && aspectRatioValue(aspectRatio) !== null);
      const ratio =
        lockAspect && videoWidth > 0 && videoHeight > 0
          ? aspectRatioValue(aspectRatio) ?? videoWidth / videoHeight
          : aspectRatioValue(aspectRatio);
      const resizeFromCenter = event.altKey;

      if (mode.type === "move") {
        applyCrop({
          ...mode.origin,
          x: mode.origin.x + dx,
          y: mode.origin.y + dy,
        });
        return;
      }

      let { x, y, width, height } = mode.origin;
      const origin = mode.origin;

      if (resizeFromCenter) {
        const centerX = origin.x + origin.width / 2;
        const centerY = origin.y + origin.height / 2;
        let halfW = origin.width / 2;
        let halfH = origin.height / 2;
        switch (mode.handle) {
          case "nw":
          case "w":
          case "sw":
            halfW -= dx / 2;
            break;
          case "ne":
          case "e":
          case "se":
            halfW += dx / 2;
            break;
        }
        switch (mode.handle) {
          case "nw":
          case "n":
          case "ne":
            halfH -= dy / 2;
            break;
          case "sw":
          case "s":
          case "se":
            halfH += dy / 2;
            break;
        }
        halfW = Math.max(1, halfW);
        halfH = Math.max(1, halfH);
        if (ratio) {
          halfH = halfW / ratio;
        }
        x = centerX - halfW;
        y = centerY - halfH;
        width = halfW * 2;
        height = halfH * 2;
        applyCrop({ x, y, width, height });
        return;
      }

      switch (mode.handle) {
        case "nw":
          x += dx;
          y += dy;
          width -= dx;
          height -= dy;
          break;
        case "n":
          y += dy;
          height -= dy;
          break;
        case "ne":
          y += dy;
          width += dx;
          height -= dy;
          break;
        case "e":
          width += dx;
          break;
        case "se":
          width += dx;
          height += dy;
          break;
        case "s":
          height += dy;
          break;
        case "sw":
          x += dx;
          width -= dx;
          height += dy;
          break;
        case "w":
          x += dx;
          width -= dx;
          break;
      }

      if (ratio) {
        height = width / ratio;
        if (mode.handle.includes("n")) {
          y = mode.origin.y + mode.origin.height - height;
        }
        if (mode.handle === "w" || mode.handle === "nw" || mode.handle === "sw") {
          x = mode.origin.x + mode.origin.width - width;
        }
      }

      applyCrop({ x, y, width, height });
    },
    [applyCrop, aspectRatio, content.renderHeight, content.renderWidth, videoHeight, videoWidth]
  );

  if (!cropEnabled || videoWidth <= 0 || videoHeight <= 0) {
    return null;
  }

  const startDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    mode: DragMode
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const overlayRect = event.currentTarget.closest(".crop-overlay")!.getBoundingClientRect();
    dragRef.current = mode;
    event.currentTarget.setPointerCapture(event.pointerId);

    const move = (e: PointerEvent) => onPointerMove(e, overlayRect);
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      forceRender((v) => v + 1);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="crop-overlay">
      <div
        className="crop-shade crop-shade-top"
        style={{ height: Math.max(0, displayRect.y) }}
      />
      <div
        className="crop-shade crop-shade-bottom"
        style={{
          top: displayRect.y + displayRect.height,
          height: Math.max(0, containerHeight - displayRect.y - displayRect.height),
        }}
      />
      <div
        className="crop-shade crop-shade-left"
        style={{
          top: displayRect.y,
          width: Math.max(0, displayRect.x),
          height: displayRect.height,
        }}
      />
      <div
        className="crop-shade crop-shade-right"
        style={{
          top: displayRect.y,
          left: displayRect.x + displayRect.width,
          width: Math.max(0, containerWidth - displayRect.x - displayRect.width),
          height: displayRect.height,
        }}
      />

      <div
        className="crop-box"
        style={{
          left: displayRect.x,
          top: displayRect.y,
          width: displayRect.width,
          height: displayRect.height,
        }}
        onPointerDown={(event) => {
          const rect = event.currentTarget.closest(".crop-overlay")!.getBoundingClientRect();
          const pointer = pointerToDisplay(event.clientX, event.clientY, rect);
          startDrag(event, {
            type: "move",
            startX: pointer.x,
            startY: pointer.y,
            origin: { ...crop },
          });
        }}
      >
        <div className="crop-grid" />
        {HANDLES.map((handle) => (
          <div
            key={handle}
            className={`crop-handle crop-handle-${handle}`}
            onPointerDown={(event) => {
              const rect = event.currentTarget.closest(".crop-overlay")!.getBoundingClientRect();
              const pointer = pointerToDisplay(event.clientX, event.clientY, rect);
              startDrag(event, {
                type: "resize",
                handle,
                startX: pointer.x,
                startY: pointer.y,
                origin: { ...crop },
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}
