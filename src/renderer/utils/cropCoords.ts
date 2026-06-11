import type { CropRect } from "../../shared/clipEdit";

export type VideoContentRect = {
  offsetX: number;
  offsetY: number;
  renderWidth: number;
  renderHeight: number;
};

export function getVideoContentRect(
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number
): VideoContentRect {
  if (videoWidth <= 0 || videoHeight <= 0) {
    return {
      offsetX: 0,
      offsetY: 0,
      renderWidth: containerWidth,
      renderHeight: containerHeight,
    };
  }

  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;

  if (videoAspect > containerAspect) {
    const renderWidth = containerWidth;
    const renderHeight = containerWidth / videoAspect;
    return {
      offsetX: 0,
      offsetY: (containerHeight - renderHeight) / 2,
      renderWidth,
      renderHeight,
    };
  }

  const renderHeight = containerHeight;
  const renderWidth = containerHeight * videoAspect;
  return {
    offsetX: (containerWidth - renderWidth) / 2,
    offsetY: 0,
    renderWidth,
    renderHeight,
  };
}

export function videoToDisplayRect(
  crop: CropRect,
  content: VideoContentRect,
  videoWidth: number,
  videoHeight: number
): { x: number; y: number; width: number; height: number } {
  const scaleX = content.renderWidth / videoWidth;
  const scaleY = content.renderHeight / videoHeight;

  return {
    x: content.offsetX + crop.x * scaleX,
    y: content.offsetY + crop.y * scaleY,
    width: crop.width * scaleX,
    height: crop.height * scaleY,
  };
}

export function displayToVideoRect(
  display: { x: number; y: number; width: number; height: number },
  content: VideoContentRect,
  videoWidth: number,
  videoHeight: number
): CropRect {
  const scaleX = videoWidth / content.renderWidth;
  const scaleY = videoHeight / content.renderHeight;

  const x = (display.x - content.offsetX) * scaleX;
  const y = (display.y - content.offsetY) * scaleY;
  const width = display.width * scaleX;
  const height = display.height * scaleY;

  return clampCropToVideo(
    {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    },
    videoWidth,
    videoHeight
  );
}

export function clampCropToVideo(
  crop: CropRect,
  videoWidth: number,
  videoHeight: number
): CropRect {
  const minSize = 16;
  let width = Math.max(minSize, Math.min(crop.width, videoWidth));
  let height = Math.max(minSize, Math.min(crop.height, videoHeight));
  let x = Math.max(0, Math.min(crop.x, videoWidth - width));
  let y = Math.max(0, Math.min(crop.y, videoHeight - height));

  if (x + width > videoWidth) {
    width = videoWidth - x;
  }
  if (y + height > videoHeight) {
    height = videoHeight - y;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(Math.max(minSize, width)),
    height: Math.round(Math.max(minSize, height)),
  };
}

export function aspectRatioValue(ratio: string): number | null {
  switch (ratio) {
    case "16:9":
      return 16 / 9;
    case "9:16":
      return 9 / 16;
    case "1:1":
      return 1;
    case "4:3":
      return 4 / 3;
    default:
      return null;
  }
}
