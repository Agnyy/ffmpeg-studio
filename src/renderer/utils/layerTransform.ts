import type { CropRect } from "../../shared/clipEdit";
import type { LayerTransform } from "../../shared/transform";
import { createDefaultTransform } from "../../shared/transform";

export type CompCanvasLayout = {
  scale: number;
  offsetX: number;
  offsetY: number;
  renderWidth: number;
  renderHeight: number;
};

export type LayerBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
};

export function getLayerSourceSize(
  sourceWidth: number,
  sourceHeight: number,
  _crop?: CropRect,
  _cropEnabled?: boolean
): { width: number; height: number } {
  return { width: sourceWidth, height: sourceHeight };
}

export type LayerDisplayGeometry = {
  fullWidth: number;
  fullHeight: number;
  fullLeft: number;
  fullTop: number;
  anchorX: number;
  anchorY: number;
  cropEnabled: boolean;
  cropViewport?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

export function getLayerDisplayGeometry(
  transform: LayerTransform,
  sourceWidth: number,
  sourceHeight: number,
  crop?: CropRect,
  cropEnabled?: boolean
): LayerDisplayGeometry {
  const scaleX = transform.scaleX / 100;
  const scaleY = transform.scaleY / 100;
  const fullWidth = sourceWidth * scaleX;
  const fullHeight = sourceHeight * scaleY;
  const fullLeft = transform.positionX - fullWidth * transform.anchorX;
  const fullTop = transform.positionY - fullHeight * transform.anchorY;

  if (!cropEnabled || !crop) {
    return {
      fullWidth,
      fullHeight,
      fullLeft,
      fullTop,
      anchorX: transform.anchorX,
      anchorY: transform.anchorY,
      cropEnabled: false,
    };
  }

  return {
    fullWidth,
    fullHeight,
    fullLeft,
    fullTop,
    anchorX: transform.anchorX,
    anchorY: transform.anchorY,
    cropEnabled: true,
    cropViewport: {
      left: fullLeft + crop.x * scaleX,
      top: fullTop + crop.y * scaleY,
      width: crop.width * scaleX,
      height: crop.height * scaleY,
    },
  };
}

export function getScaledLayerSize(
  sourceWidth: number,
  sourceHeight: number,
  transform: LayerTransform
): { width: number; height: number } {
  return {
    width: (sourceWidth * transform.scaleX) / 100,
    height: (sourceHeight * transform.scaleY) / 100,
  };
}

export function getLayerBounds(
  transform: LayerTransform,
  sourceWidth: number,
  sourceHeight: number
): LayerBounds {
  const { width, height } = getScaledLayerSize(sourceWidth, sourceHeight, transform);
  return {
    left: transform.positionX - width * transform.anchorX,
    top: transform.positionY - height * transform.anchorY,
    width,
    height,
    anchorX: transform.anchorX,
    anchorY: transform.anchorY,
  };
}

export function getCompCanvasLayout(
  containerWidth: number,
  containerHeight: number,
  compWidth: number,
  compHeight: number
): CompCanvasLayout {
  if (containerWidth <= 0 || containerHeight <= 0 || compWidth <= 0 || compHeight <= 0) {
    return {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      renderWidth: compWidth,
      renderHeight: compHeight,
    };
  }

  const scale = Math.min(containerWidth / compWidth, containerHeight / compHeight);
  const renderWidth = compWidth * scale;
  const renderHeight = compHeight * scale;
  return {
    scale,
    offsetX: (containerWidth - renderWidth) / 2,
    offsetY: (containerHeight - renderHeight) / 2,
    renderWidth,
    renderHeight,
  };
}

export function compToDisplay(
  compX: number,
  compY: number,
  layout: CompCanvasLayout
): { x: number; y: number } {
  return {
    x: layout.offsetX + compX * layout.scale,
    y: layout.offsetY + compY * layout.scale,
  };
}

export function displayToComp(
  displayX: number,
  displayY: number,
  layout: CompCanvasLayout
): { x: number; y: number } {
  return {
    x: (displayX - layout.offsetX) / layout.scale,
    y: (displayY - layout.offsetY) / layout.scale,
  };
}

export function centerTransform(
  compWidth: number,
  compHeight: number,
  transform: LayerTransform
): LayerTransform {
  return {
    ...transform,
    positionX: compWidth / 2,
    positionY: compHeight / 2,
  };
}

export function fitTransform(
  compWidth: number,
  compHeight: number,
  videoWidth: number,
  videoHeight: number,
  transform: LayerTransform
): LayerTransform {
  const scale = Math.min(compWidth / videoWidth, compHeight / videoHeight) * 100;
  return {
    ...transform,
    positionX: compWidth / 2,
    positionY: compHeight / 2,
    scaleX: scale,
    scaleY: scale,
  };
}

export function fillTransform(
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

export function resetTransform(compWidth: number, compHeight: number): LayerTransform {
  return createDefaultTransform(compWidth, compHeight);
}

export function isDefaultTransform(
  transform: LayerTransform,
  compWidth: number,
  compHeight: number
): boolean {
  const defaults = createDefaultTransform(compWidth, compHeight);
  return (
    Math.abs(transform.positionX - defaults.positionX) < 0.5 &&
    Math.abs(transform.positionY - defaults.positionY) < 0.5 &&
    Math.abs(transform.scaleX - 100) < 0.01 &&
    Math.abs(transform.scaleY - 100) < 0.01 &&
    Math.abs(transform.rotation) < 0.01 &&
    Math.abs(transform.opacity - 100) < 0.01
  );
}

export function getTransformRenderWarnings(transform: LayerTransform): string[] {
  const warnings: string[] = [];
  if (transform.opacity < 100) {
    warnings.push("Opacity is applied in render via alpha channel.");
  }
  const normalized = ((transform.rotation % 360) + 360) % 360;
  if (normalized % 90 > 0.01 && normalized % 90 < 89.99) {
    warnings.push("Arbitrary rotation is enabled in preview and render.");
  }
  return warnings;
}
