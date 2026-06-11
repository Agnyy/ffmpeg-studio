export const MIN_TIMELINE_ZOOM = 2;
export const MAX_TIMELINE_ZOOM = 1200;
export const DEFAULT_TIMELINE_ZOOM = 20;
export const FRAME_TICK_ZOOM_THRESHOLD = 300;
export const THUMBNAIL_ZOOM_THRESHOLD = 80;

export const BASE_LAYER_ROW_HEIGHT = 32;
export const BASE_PROPERTY_ROW_HEIGHT = 24;
export const LAYER_ROW_HEIGHT = BASE_LAYER_ROW_HEIGHT;
export const PROPERTY_ROW_HEIGHT = BASE_PROPERTY_ROW_HEIGHT;
export const RULER_HEIGHT = 28;

export const MIN_TIMELINE_ZOOM_Y = 0.75;
export const MAX_TIMELINE_ZOOM_Y = 2.5;
export const DEFAULT_TIMELINE_ZOOM_Y = 1;

export type TimelineZoomMode = "fit" | "manual";
export type TimelineViewMode = "layer" | "tracks";

export function scaledRowHeights(zoomY: number): {
  layerRowHeight: number;
  propertyRowHeight: number;
} {
  const y = clampTimelineZoomY(zoomY);
  return {
    layerRowHeight: BASE_LAYER_ROW_HEIGHT * y,
    propertyRowHeight: BASE_PROPERTY_ROW_HEIGHT * y,
  };
}

export function clampTimelineZoomY(zoomY: number): number {
  return Math.max(MIN_TIMELINE_ZOOM_Y, Math.min(MAX_TIMELINE_ZOOM_Y, zoomY));
}

export function clampTimelineZoom(zoom: number): number {
  return Math.max(MIN_TIMELINE_ZOOM, Math.min(MAX_TIMELINE_ZOOM, zoom));
}

export function fitTimelineZoom(duration: number, viewportWidth: number): number {
  const safeDuration = Math.max(duration, 0.1);
  const fit = (viewportWidth - 32) / safeDuration;
  return clampTimelineZoom(fit);
}

export function timeToX(time: number, zoom: number): number {
  return time * zoom;
}

export function xToTime(x: number, zoom: number): number {
  if (zoom <= 0) {
    return 0;
  }
  return x / zoom;
}

export function timelineContentWidth(duration: number, zoom: number): number {
  return Math.max(timeToX(duration, zoom), 100);
}
