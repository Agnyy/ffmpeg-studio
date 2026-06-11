import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRenderCount } from "../hooks/useRenderCount";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Crop,
  Eye,
  EyeOff,
  Film,
  Layers,
  Lock,
  Move,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Unlock,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { CompositionRenderRange } from "../../ffmpeg/compositionRenderBuilder";
import type { RenderRange } from "../../shared/projectDocument";
import type { LayerTransform } from "../../shared/transform";
import type { TimelineLayer } from "../../shared/project";
import { isPrecompLayer } from "../../shared/project";
import { layerCompEnd, layerDuration } from "../../shared/project";
import type { EditorTool } from "../../tools/toolTypes";
import { getToolCursorClass } from "../../tools/toolState";
import type { useMediaVisualCache } from "../hooks/useMediaVisualCache";
import AudioWaveform from "./AudioWaveform";
import CompositionIcon from "./CompositionIcon";
import TimelineEffectKeyframeTrack from "./TimelineEffectKeyframeTrack";
import TimelineKeyframeTrack from "./TimelineKeyframeTrack";
import TimelinePropertySidebarRow, {
  type PropertyRow,
} from "./TimelinePropertySidebarRow";
import {
  getPropertyRows,
  isPropertyRowChanged,
  NORMAL_TIMELINE_REVEAL,
  propertyRowMatchesHighlight,
  type TimelineRevealState,
} from "../utils/timelinePropertyReveal";
import TimelinePreviewCacheBar from "./TimelinePreviewCacheBar";
import TimelinePreviewBufferBar from "./TimelinePreviewBufferBar";
import type { PreviewBufferState } from "../../shared/previewBufferedRanges";
import type { PreviewCacheState } from "../../shared/previewCache";
import TimelineThumbnails from "./TimelineThumbnails";
import type { TransformGroupKey } from "../../keyframes/keyframeTypes";
import { TRANSFORM_GROUP_PROPERTIES } from "../../keyframes/keyframeTypes";
import { isEffectParamAnimationEnabled } from "../../keyframes/layerEffectKeyframes";
import type { SelectedKeyframeRef } from "../../keyframes/keyframeSelection";
import { isKeyframeSelected } from "../../keyframes/keyframeSelection";
import { isTransformGroupEnabled } from "../../keyframes/layerTransformKeyframes";
import type { KeyframeContextMenuState } from "./KeyframeContextMenu";
import { extractDroppedPaths, preventDragDefaults } from "../utils/dnd";
import { snapTime } from "../utils/timelineSnap";
import { formatTimecode, frameDuration, snapTimeToFrame } from "../utils/time";
import type { ProjectItem } from "../../shared/project";
import {
  clampTimelineLeftWidth,
  loadTimelineLeftWidth,
  saveTimelineLeftWidth,
} from "../utils/timelineLayout";
import {
  clampTimelineZoom,
  clampTimelineZoomY,
  fitTimelineZoom,
  RULER_HEIGHT,
  timelineContentWidth,
  timeToX,
  xToTime,
  MIN_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
  DEFAULT_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM_Y,
  MAX_TIMELINE_ZOOM_Y,
  DEFAULT_TIMELINE_ZOOM_Y,
  FRAME_TICK_ZOOM_THRESHOLD,
  THUMBNAIL_ZOOM_THRESHOLD,
  scaledRowHeights,
  type TimelineZoomMode,
  type TimelineViewMode,
} from "../utils/timelineZoom";
import { logTimelineClick } from "../utils/timelineSeekDebug";

const ICON_SIZE = 13;

type TimelineEditorProps = {
  embedded?: boolean;
  duration: number;
  layers: TimelineLayer[];
  selectedLayerId: string | null;
  compCurrentTime: number;
  workAreaStart?: number;
  workAreaEnd?: number;
  fps: number;
  sourceDurations: Record<string, number>;
  onSeek: (time: number) => void;
  onSelectLayer: (
    layerId: string,
    modifiers?: { ctrlKey?: boolean; shiftKey?: boolean }
  ) => void;
  onOpenPrecompLayer?: (compositionId: string) => void;
  onLayerChange: (layerId: string, patch: Partial<TimelineLayer>) => void;
  onDropPaths: (paths: string[]) => void;
  onLayerDragStart?: () => void;
  onTransformChange?: (layerId: string, patch: Partial<LayerTransform>) => void;
  onToggleTransformAnimation?: (layerId: string, group: TransformGroupKey) => void;
  onToggleKeyframeDiamond?: (layerId: string, group: TransformGroupKey) => void;
  onToggleEffectParamAnimation?: (layerId: string, effectId: string, param: string) => void;
  onToggleEffectParamDiamond?: (layerId: string, effectId: string, param: string) => void;
  onEffectParamChange?: (layerId: string, effectId: string, param: string, value: number) => void;
  onLayerDragEnd?: () => void;
  selectedKeyframes?: SelectedKeyframeRef[];
  onSelectKeyframe?: (selection: SelectedKeyframeRef, options?: { additive?: boolean }) => void;
  onClearKeyframeSelection?: () => void;
  onMoveKeyframe?: (
    layerId: string,
    property: import("../../keyframes/keyframeTypes").TransformPropertyKey,
    keyframeId: string,
    newTime: number
  ) => void;
  onMoveEffectKeyframe?: (
    layerId: string,
    effectId: string,
    param: string,
    keyframeId: string,
    newTime: number
  ) => void;
  onKeyframeDragStart?: () => void;
  onKeyframeDragEnd?: () => void;
  onOpenKeyframeContextMenu?: (state: NonNullable<KeyframeContextMenuState>) => void;
  viewMode?: TimelineViewMode;
  onViewModeChange?: (mode: TimelineViewMode) => void;
  renderRange?: RenderRange;
  resolvedRenderRange?: CompositionRenderRange;
  activeTool?: EditorTool;
  isSpacePanActive?: boolean;
  onSpacePanOccurred?: () => void;
  onSplitLayer?: (layerId: string, splitTime: number) => void;
  mediaCache?: Pick<
    ReturnType<typeof useMediaVisualCache>,
    "getThumbnailEntry" | "requestThumbnails" | "getWaveformEntry" | "requestWaveform"
  >;
  previewPathBySourcePath?: Record<string, string>;
  footageBySourcePath?: Record<string, ProjectItem>;
  compWidth?: number;
  compHeight?: number;
  timelineRevealState?: TimelineRevealState;
  onClearTimelineReveal?: () => void;
  previewCache?: PreviewCacheState;
  previewBufferState?: PreviewBufferState;
};

function propertyRowKey(layerId: string, row: PropertyRow): string {
  if (row.kind === "effect") {
    return `${layerId}-effect-${row.effectId}`;
  }
  if (row.kind === "effect-param") {
    return `${layerId}-effect-param-${row.effectId}-${row.param}`;
  }
  if (row.kind === "crop-field") {
    return `${layerId}-crop-${row.field}`;
  }
  return `${layerId}-${row.kind}`;
}

type TrackRowKind = "video" | "audio";

type TrackRow = {
  kind: TrackRowKind;
  layer: TimelineLayer;
};

type DragMode = "playhead" | "move" | "trimLeft" | "trimRight" | null;

type DragState = {
  mode: DragMode;
  layerId: string;
  pointerId: number;
  startPointerX: number;
  lockedZoom: number;
  initialStart: number;
  initialIn: number;
  initialOut: number;
  initialCompEnd: number;
  pendingPatch: Partial<TimelineLayer> | null;
};

type DragLayerPreview = {
  layerId: string;
  patch: Partial<TimelineLayer>;
};

type PanState = {
  pointerId: number;
  startPointerX: number;
  startScrollLeft: number;
};

const KEYFRAME_ROW_GROUPS: Record<
  "keyframe-position" | "keyframe-scale" | "keyframe-rotation" | "keyframe-opacity",
  { group: TransformGroupKey; label: string }
> = {
  "keyframe-position": { group: "position", label: "Position" },
  "keyframe-scale": { group: "scale", label: "Scale" },
  "keyframe-rotation": { group: "rotation", label: "Rotation" },
  "keyframe-opacity": { group: "opacity", label: "Opacity" },
};

const SNAP_PX = 7;

function getTrackRows(layers: TimelineLayer[]): TrackRow[] {
  const sorted = [...layers].sort((a, b) => a.index - b.index);
  const rows: TrackRow[] = [];
  for (const layer of sorted) {
    if (layer.hasVideo) {
      rows.push({ kind: "video", layer });
    }
    if (layer.hasAudio) {
      rows.push({ kind: "audio", layer });
    }
  }
  return rows;
}

function trackLabel(kind: TrackRowKind, layerIndex: number): string {
  return kind === "video" ? `V${layerIndex}` : `A${layerIndex}`;
}

function TimelineEditor({
  embedded = false,
  duration,
  layers,
  selectedLayerId,
  compCurrentTime,
  workAreaStart = 0,
  workAreaEnd,
  fps,
  sourceDurations,
  onSeek,
  onSelectLayer,
  onOpenPrecompLayer,
  onLayerChange,
  onDropPaths,
  onLayerDragStart,
  onTransformChange,
  onToggleTransformAnimation,
  onToggleKeyframeDiamond,
  onToggleEffectParamAnimation,
  onToggleEffectParamDiamond,
  onEffectParamChange,
  onLayerDragEnd,
  selectedKeyframes = [],
  onSelectKeyframe,
  onClearKeyframeSelection,
  onMoveKeyframe,
  onMoveEffectKeyframe,
  onKeyframeDragStart,
  onKeyframeDragEnd,
  onOpenKeyframeContextMenu,
  viewMode = "layer",
  onViewModeChange,
  renderRange = "full",
  resolvedRenderRange,
  activeTool = "selection",
  isSpacePanActive = false,
  onSpacePanOccurred,
  onSplitLayer,
  mediaCache,
  previewPathBySourcePath = {},
  footageBySourcePath = {},
  compWidth = 1920,
  compHeight = 1080,
  timelineRevealState = NORMAL_TIMELINE_REVEAL,
  onClearTimelineReveal,
  previewCache,
  previewBufferState,
}: TimelineEditorProps) {
  useRenderCount("TimelineEditor");

  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const zoomRef = useRef(DEFAULT_TIMELINE_ZOOM);
  const hasInitialFitRef = useRef(false);

  const [timelineZoom, setTimelineZoom] = useState(DEFAULT_TIMELINE_ZOOM);
  const [timelineZoomY, setTimelineZoomY] = useState(DEFAULT_TIMELINE_ZOOM_Y);
  const [timelineZoomMode, setTimelineZoomMode] = useState<TimelineZoomMode>("fit");
  const [leftPaneWidth, setLeftPaneWidth] = useState(loadTimelineLeftWidth);
  const [isResizingLeftPane, setIsResizingLeftPane] = useState(false);
  const [hoveredPropertyRowKey, setHoveredPropertyRowKey] = useState<string | null>(null);
  const [dragLayerPreview, setDragLayerPreview] = useState<DragLayerPreview | null>(null);

  const applyDragPreviewLayer = useCallback(
    (layer: TimelineLayer): TimelineLayer => {
      if (dragLayerPreview?.layerId !== layer.id) {
        return layer;
      }
      const merged: TimelineLayer = { ...layer, ...dragLayerPreview.patch };
      if (dragLayerPreview.patch.transform) {
        merged.transform = { ...layer.transform, ...dragLayerPreview.patch.transform };
      }
      return merged;
    },
    [dragLayerPreview]
  );
  const timelineFocusRef = useRef<HTMLElement>(null);
  const leftPaneResizeRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(
    null
  );
  zoomRef.current = timelineZoom;

  const propertyRowOptions = useMemo(
    () => ({
      reveal: timelineRevealState,
      compWidth,
      compHeight,
      selectedLayerId,
      activeTool,
    }),
    [timelineRevealState, compWidth, compHeight, selectedLayerId, activeTool]
  );

  const resolvePropertyRows = useCallback(
    (layer: TimelineLayer) => getPropertyRows(layer, propertyRowOptions),
    [propertyRowOptions]
  );

  const isRowHighlighted = useCallback(
    (layer: TimelineLayer, row: PropertyRow) => {
      if (selectedLayerId !== layer.id || timelineRevealState.mode === "normal") {
        return false;
      }
      if (timelineRevealState.mode === "property-reveal") {
        return timelineRevealState.properties.some((property) =>
          propertyRowMatchesHighlight(row, property)
        );
      }
      if (timelineRevealState.mode === "changed-only") {
        return isPropertyRowChanged(layer, row, compWidth, compHeight);
      }
      return false;
    },
    [compHeight, compWidth, timelineRevealState, selectedLayerId]
  );

  const { layerRowHeight, propertyRowHeight } = scaledRowHeights(timelineZoomY);

  const safeDuration = Math.max(duration, 0.1);
  const minLayerDuration = frameDuration(fps);
  const resolvedWorkAreaEnd = workAreaEnd ?? safeDuration;
  const workAreaLeft = Math.max(0, Math.min(workAreaStart, safeDuration));
  const workAreaRight = Math.max(workAreaLeft, Math.min(resolvedWorkAreaEnd, safeDuration));
  const hasWorkArea = workAreaRight > workAreaLeft + 0.001;
  const renderRangeStart = resolvedRenderRange?.start ?? 0;
  const renderRangeEnd = resolvedRenderRange?.end ?? safeDuration;
  const hasRenderRange =
    renderRangeEnd > renderRangeStart + 0.001 &&
    (renderRange !== "full" || resolvedRenderRange !== undefined);
  const contentWidth = timelineContentWidth(safeDuration, timelineZoom);
  const safeCurrentTime = Number.isFinite(compCurrentTime) ? compCurrentTime : 0;

  const getContentX = useCallback((clientX: number) => {
    const scroll = scrollRef.current;
    if (!scroll) {
      return 0;
    }
    const rect = scroll.getBoundingClientRect();
    return clientX - rect.left + scroll.scrollLeft;
  }, []);

  const getSnapTargets = useCallback(
    (excludeLayerId?: string) => {
      const targets = [0, safeCurrentTime, workAreaLeft, workAreaRight];
      for (const layer of layers) {
        if (layer.id === excludeLayerId) {
          continue;
        }
        targets.push(layer.startTime, layerCompEnd(layer));
      }
      return targets;
    },
    [layers, safeCurrentTime, workAreaLeft, workAreaRight]
  );

  const applySnapWithZoom = useCallback(
    (time: number, zoom: number, excludeLayerId?: string) => {
      const tolerance = zoom > 0 ? SNAP_PX / zoom : 0.1;
      return snapTime(time, getSnapTargets(excludeLayerId), tolerance);
    },
    [getSnapTargets]
  );

  const snapTimeValue = useCallback(
    (time: number, zoom: number, excludeLayerId?: string) => {
      const snapped = applySnapWithZoom(time, zoom, excludeLayerId);
      return snapTimeToFrame(snapped, fps);
    },
    [applySnapWithZoom, fps]
  );

  const rulerMarks = useMemo(() => {
    const marks: number[] = [];
    const step =
      timelineZoom >= 40 ? 1 : timelineZoom >= 15 ? 2 : timelineZoom >= 8 ? 5 : 10;
    for (let t = 0; t <= safeDuration; t += step) {
      marks.push(t);
    }
    if (marks[marks.length - 1] !== safeDuration) {
      marks.push(safeDuration);
    }
    return marks;
  }, [safeDuration, timelineZoom]);

  const frameTicks = useMemo(() => {
    if (timelineZoom < FRAME_TICK_ZOOM_THRESHOLD) {
      return [];
    }
    const fd = frameDuration(fps);
    const ticks: { time: number; frameInSecond: number; isSecond: boolean }[] = [];
    const totalFrames = Math.ceil(safeDuration * fps);
    for (let f = 0; f <= totalFrames; f++) {
      const t = f * fd;
      if (t > safeDuration + 0.0001) {
        break;
      }
      ticks.push({
        time: t,
        frameInSecond: f % Math.round(fps),
        isSecond: f % Math.round(fps) === 0,
      });
    }
    return ticks;
  }, [fps, safeDuration, timelineZoom]);

  const fitTimeline = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) {
      return;
    }
    setTimelineZoomMode("fit");
    setTimelineZoom(fitTimelineZoom(safeDuration, scroll.clientWidth));
    scroll.scrollLeft = 0;
  }, [safeDuration]);

  const setManualZoom = useCallback((nextZoom: number) => {
    setTimelineZoomMode("manual");
    setTimelineZoom(clampTimelineZoom(nextZoom));
  }, []);

  const setManualZoomY = useCallback((nextZoomY: number) => {
    setTimelineZoomY(clampTimelineZoomY(nextZoomY));
  }, []);

  useEffect(() => {
    if (dragRef.current) {
      return;
    }
    const scroll = scrollRef.current;
    if (!scroll) {
      return;
    }
    if (!hasInitialFitRef.current) {
      hasInitialFitRef.current = true;
      setTimelineZoom(fitTimelineZoom(safeDuration, scroll.clientWidth));
      return;
    }
    if (timelineZoomMode === "fit") {
      setTimelineZoom(fitTimelineZoom(safeDuration, scroll.clientWidth));
    }
  }, [safeDuration, timelineZoomMode]);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const altHorizontalZoom =
      event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    const modifierHorizontalZoom = event.ctrlKey || event.metaKey;

    if (!altHorizontalZoom && !modifierHorizontalZoom) {
      return;
    }
    event.preventDefault();

    if (modifierHorizontalZoom && event.altKey) {
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
      setTimelineZoomY((value) => clampTimelineZoomY(value * factor));
      return;
    }

    const scroll = scrollRef.current;
    if (!scroll) {
      return;
    }

    const pointerX = getContentX(event.clientX);
    const timeAtPointer = xToTime(pointerX, zoomRef.current);
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = clampTimelineZoom(zoomRef.current * factor);
    setTimelineZoomMode("manual");
    setTimelineZoom(nextZoom);
    requestAnimationFrame(() => {
      if (scroll) {
        scroll.scrollLeft = Math.max(
          0,
          timeToX(timeAtPointer, nextZoom) -
            (event.clientX - scroll.getBoundingClientRect().left)
        );
      }
    });
  };

  const syncSidebarScroll = () => {
    const scroll = scrollRef.current;
    const sidebar = sidebarScrollRef.current;
    if (scroll && sidebar) {
      sidebar.scrollTop = scroll.scrollTop;
    }
  };

  useEffect(() => {
    const cache = mediaCache;
    if (!cache) {
      return;
    }

    let cancelled = false;

    async function loadVisuals() {
      if (!cache) {
        return;
      }
      for (const layer of layers) {
        if (cancelled || !layer.sourcePath) {
          continue;
        }
        const previewPath = previewPathBySourcePath[layer.sourcePath];
        const footageItem = footageBySourcePath[layer.sourcePath];
        if (!previewPath || !footageItem) {
          continue;
        }
        const fileUrl = await window.ffmpegStudio.toFileUrl(previewPath);
        const sourceDuration = sourceDurations[layer.sourcePath] ?? layer.outPoint;

        if (
          layer.hasVideo &&
          timelineZoom >= THUMBNAIL_ZOOM_THRESHOLD
        ) {
          const thumbCount = Math.max(
            4,
            Math.min(16, Math.ceil(layerDuration(layer) / 2))
          );
          void cache.requestThumbnails(footageItem, sourceDuration, thumbCount);
        }

        if (layer.hasAudio) {
          const peakCount = Math.max(48, Math.min(256, Math.ceil(layerDuration(layer) * 12)));
          void cache.requestWaveform(
            previewPath,
            fileUrl,
            sourceDuration,
            peakCount
          );
        }
      }
    }

    void loadVisuals();
    return () => {
      cancelled = true;
    };
  }, [footageBySourcePath, layers, mediaCache, previewPathBySourcePath, sourceDurations, timelineZoom]);

  const isPanMode = isSpacePanActive;

  const startHandPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const scroll = scrollRef.current;
    if (!scroll || !isPanMode) {
      return;
    }

    event.preventDefault();
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startScrollLeft: scroll.scrollLeft,
    };
    element.classList.add("is-panning");
    onSpacePanOccurred?.();

    const onMove = (e: PointerEvent) => {
      const pan = panRef.current;
      const scrollEl = scrollRef.current;
      if (!pan || !scrollEl || e.pointerId !== pan.pointerId) {
        return;
      }
      const deltaX = e.clientX - pan.startPointerX;
      if (Math.abs(deltaX) > 2) {
        onSpacePanOccurred?.();
      }
      scrollEl.scrollLeft = Math.max(0, pan.startScrollLeft - deltaX);
    };

    const onUp = (e: PointerEvent) => {
      const pan = panRef.current;
      if (!pan || e.pointerId !== pan.pointerId) {
        return;
      }
      panRef.current = null;
      element.classList.remove("is-panning");
      element.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleRazorClick = (
    layer: TimelineLayer,
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const element = event.currentTarget;
    const startX = event.clientX;

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) {
        return;
      }
      if (Math.abs(e.clientX - startX) < 6) {
        const x = getContentX(e.clientX);
        let time = snapTimeValue(xToTime(x, zoomRef.current), zoomRef.current);
        time = Math.max(layer.startTime + minLayerDuration, Math.min(layerCompEnd(layer) - minLayerDuration, time));
        onSplitLayer?.(layer.id, time);
      }
      element.releasePointerCapture(event.pointerId);
      window.removeEventListener("pointerup", onUp);
    };

    event.preventDefault();
    event.stopPropagation();
    element.setPointerCapture(event.pointerId);
    window.addEventListener("pointerup", onUp);
  };

  const startDrag = (
    mode: DragMode,
    layer: TimelineLayer,
    event: React.PointerEvent,
    element: HTMLElement
  ) => {
    if (activeTool !== "selection" && mode !== "playhead") {
      return;
    }
    if (mode !== "playhead" && layer.locked) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    element.setPointerCapture(event.pointerId);

    dragRef.current = {
      mode,
      layerId: layer.id,
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      lockedZoom: zoomRef.current,
      initialStart: layer.startTime,
      initialIn: layer.inPoint,
      initialOut: layer.outPoint,
      initialCompEnd: layerCompEnd(layer),
      pendingPatch: null,
    };

    if (mode !== "playhead") {
      onLayerDragStart?.();
    }

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) {
        return;
      }

      const zoom = drag.lockedZoom;

      if (drag.mode === "playhead") {
        const x = getContentX(e.clientX);
        let time = snapTimeValue(xToTime(x, zoom), zoom);
        time = Math.max(0, Math.min(safeDuration, time));
        logTimelineClick(time);
        onSeek(time);
        return;
      }

      const sourceMax = sourceDurations[layer.sourcePath] ?? drag.initialOut;

      if (drag.mode === "move") {
        const deltaX = e.clientX - drag.startPointerX;
        const deltaTime = deltaX / zoom;
        const newStart = Math.max(
          0,
          snapTimeValue(drag.initialStart + deltaTime, zoom, drag.layerId)
        );
        const patch = { startTime: newStart };
        drag.pendingPatch = patch;
        setDragLayerPreview({ layerId: drag.layerId, patch });
        return;
      }

      if (drag.mode === "trimLeft") {
        const x = getContentX(e.clientX);
        let newStart = snapTimeValue(xToTime(x, zoom), zoom, drag.layerId);
        newStart = Math.max(0, newStart);
        const delta = newStart - drag.initialStart;
        let newIn = drag.initialIn + delta;
        newIn = Math.max(0, Math.min(newIn, drag.initialOut - minLayerDuration));
        const adjustedStart = drag.initialStart + (newIn - drag.initialIn);
        const patch = {
          startTime: snapTimeToFrame(adjustedStart, fps),
          inPoint: snapTimeToFrame(newIn, fps),
        };
        drag.pendingPatch = patch;
        setDragLayerPreview({ layerId: drag.layerId, patch });
        return;
      }

      if (drag.mode === "trimRight") {
        const x = getContentX(e.clientX);
        let newCompEnd = snapTimeValue(xToTime(x, zoom), zoom, drag.layerId);
        newCompEnd = Math.max(
          drag.initialStart + minLayerDuration,
          Math.min(newCompEnd, safeDuration)
        );
        let newOut = drag.initialIn + (newCompEnd - drag.initialStart);
        newOut = Math.max(drag.initialIn + minLayerDuration, Math.min(newOut, sourceMax));
        const patch = { outPoint: snapTimeToFrame(newOut, fps) };
        drag.pendingPatch = patch;
        setDragLayerPreview({ layerId: drag.layerId, patch });
      }
    };

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) {
        return;
      }
      const wasLayerDrag = drag.mode !== "playhead";
      const pendingPatch = drag.pendingPatch;
      const layerId = drag.layerId;
      dragRef.current = null;
      setDragLayerPreview(null);
      element.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (wasLayerDrag) {
        if (pendingPatch) {
          onLayerChange(layerId, pendingPatch);
        }
        onLayerDragEnd?.();
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const seekTimelineFromClientX = useCallback(
    (clientX: number) => {
      if (dragRef.current || isPanMode || activeTool === "razor") {
        return;
      }
      const x = getContentX(clientX);
      let time = snapTimeValue(xToTime(x, timelineZoom), timelineZoom);
      time = Math.max(0, Math.min(safeDuration, time));
      logTimelineClick(time);
      onSeek(time);
    },
    [activeTool, getContentX, isPanMode, onSeek, safeDuration, snapTimeValue, timelineZoom]
  );

  const handleRulerClick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current || isPanMode || activeTool === "razor") {
      return;
    }
    onClearKeyframeSelection?.();
    seekTimelineFromClientX(event.clientX);
  };

  const handleTimelineBackgroundPointerDown = (event: React.PointerEvent) => {
    const target = event.target as HTMLElement;
    if (
      target.classList.contains("timeline-track-bg") ||
      target.classList.contains("timeline-property-spacer") ||
      target.classList.contains("timeline-keyframe-track-empty") ||
      target.classList.contains("timeline-scroll-content")
    ) {
      onClearKeyframeSelection?.();
      seekTimelineFromClientX(event.clientX);
    }
  };

  const renderKeyframePropertyLabel = (
    layer: TimelineLayer,
    group: TransformGroupKey,
    label: string
  ) => {
    const enabled = isTransformGroupEnabled(layer.keyframes, group);
    const keyCount = TRANSFORM_GROUP_PROPERTIES[group].reduce(
      (sum, key) => sum + layer.keyframes[key].keyframes.length,
      0
    );
    const hasSelection = TRANSFORM_GROUP_PROPERTIES[group].some((property) =>
      layer.keyframes[property].keyframes.some((kf) =>
        isKeyframeSelected(selectedKeyframes, layer.id, {
          kind: "transform",
          property,
          keyframeId: kf.id,
        })
      )
    );
    return (
      <span className={`timeline-kf-property-label ${hasSelection ? "selected" : ""}`}>
        <Timer size={11} className={enabled ? "stopwatch-on" : "stopwatch-off"} />
        <span>{label}</span>
        <span className="timeline-kf-key-count">
          {keyCount} {keyCount === 1 ? "key" : "keys"}
        </span>
      </span>
    );
  };

  const handleTimelineDrop = (event: React.DragEvent) => {
    preventDragDefaults(event);
    const paths = extractDroppedPaths(event);
    if (paths.length > 0) {
      onDropPaths(paths);
    }
  };

  const toggleLayerFlag = (
    layer: TimelineLayer,
    key: "enabled" | "locked" | "muted" | "collapsed"
  ) => {
    onLayerChange(layer.id, { [key]: !layer[key] });
  };

  const handleLayerSelect = (
    layerId: string,
    event: React.MouseEvent
  ) => {
    onSelectLayer(layerId, {
      ctrlKey: event.ctrlKey || event.metaKey,
      shiftKey: event.shiftKey,
    });
  };

  const handleLayerOpen = (layer: TimelineLayer) => {
    if (isPrecompLayer(layer) && layer.sourceCompositionId) {
      onOpenPrecompLayer?.(layer.sourceCompositionId);
    }
  };

  const togglePropertyExpand = (layer: TimelineLayer, row: PropertyRow) => {
    onClearTimelineReveal?.();
    if (row.kind === "transform") {
      onLayerChange(layer.id, { transformExpanded: !layer.transformExpanded });
    }
    if (row.kind === "audio") {
      onLayerChange(layer.id, { audioExpanded: !layer.audioExpanded });
    }
    if (row.kind === "crop") {
      onLayerChange(layer.id, { cropExpanded: !layer.cropExpanded });
    }
    if (row.kind === "effect") {
      onLayerChange(layer.id, {
        effects: layer.effects?.map((entry) =>
          entry.id === row.effectId ? { ...entry, collapsed: !entry.collapsed } : entry
        ),
      });
    }
  };

  const focusTimeline = () => {
    timelineFocusRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    saveTimelineLeftWidth(leftPaneWidth);
  }, [leftPaneWidth]);

  const startLeftPaneResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    leftPaneResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: leftPaneWidth,
    };
    setIsResizingLeftPane(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveLeftPaneResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = leftPaneResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }
    const delta = event.clientX - resize.startX;
    setLeftPaneWidth(clampTimelineLeftWidth(resize.startWidth + delta));
  };

  const endLeftPaneResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = leftPaneResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }
    leftPaneResizeRef.current = null;
    setIsResizingLeftPane(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const sortedLayers = [...layers].sort((a, b) => a.index - b.index);
  const trackRows = getTrackRows(sortedLayers);

  const zoomOut = () => setManualZoom(timelineZoom / 1.25);
  const zoomIn = () => setManualZoom(timelineZoom * 1.25);
  const zoomOutY = () => setManualZoomY(timelineZoomY / 1.1);
  const zoomInY = () => setManualZoomY(timelineZoomY * 1.1);

  const renderWaveformContent = (layer: TimelineLayer, clipWidth: number, blockHeight: number) => {
    const sourceDuration = sourceDurations[layer.sourcePath] ?? layer.outPoint;
    const previewPath = previewPathBySourcePath[layer.sourcePath];
    const waveformEntry = previewPath
      ? mediaCache?.getWaveformEntry(previewPath, sourceDuration)
      : undefined;
    return (
      <AudioWaveform
        peaks={waveformEntry?.data ?? []}
        loading={waveformEntry?.status === "loading"}
        width={clipWidth}
        height={Math.max(12, blockHeight - 8)}
        inPoint={layer.inPoint}
        outPoint={layer.outPoint}
        sourceDuration={sourceDuration}
        muted={layer.muted}
      />
    );
  };

  const renderClipBlock = (
    layer: TimelineLayer,
    variant: TrackRowKind | "layer" = "layer"
  ) => {
    const displayLayer = applyDragPreviewLayer(layer);
    const clipWidth = Math.max(timeToX(layerDuration(displayLayer), timelineZoom), 8);
    const isSelected = selectedLayerId === layer.id;
    const showVideoThumbs =
      (variant === "video" || variant === "layer") &&
      layer.hasVideo &&
      timelineZoom >= THUMBNAIL_ZOOM_THRESHOLD;
    const showAudioWaveform = variant === "audio" && layer.hasAudio;
    const sourceDuration = sourceDurations[layer.sourcePath] ?? layer.outPoint;
    const previewPath = previewPathBySourcePath[layer.sourcePath];
    const thumbnailEntry = previewPath
      ? mediaCache?.getThumbnailEntry(layer.sourceItemId, previewPath, sourceDuration)
      : undefined;
    const variantClass =
      variant === "audio"
        ? "timeline-clip-audio"
        : variant === "video"
          ? "timeline-clip-video"
          : "";

    const handleClipPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).classList.contains("timeline-layer-trim")) {
        return;
      }

      onSelectLayer(layer.id);

      if (activeTool === "razor") {
        handleRazorClick(layer, event);
        return;
      }

      if (isPanMode) {
        const scroll = scrollRef.current;
        if (scroll) {
          startHandPan({
            ...event,
            currentTarget: scroll,
            preventDefault: () => event.preventDefault(),
          } as React.PointerEvent<HTMLDivElement>);
        }
        return;
      }

      if (activeTool === "crop") {
        event.stopPropagation();
        return;
      }

      startDrag("move", layer, event, event.currentTarget);
    };

    return (
      <div
        className={`timeline-layer-block ${variantClass} ${isSelected ? "selected" : ""} ${!layer.enabled ? "layer-disabled" : ""} ${layer.muted && variant === "audio" ? "audio-muted" : ""} ${activeTool === "razor" ? "razor-target" : ""}`}
        style={{
          left: timeToX(displayLayer.startTime, timelineZoom),
          width: clipWidth,
        }}
        onPointerDown={handleClipPointerDown}
      >
        {activeTool === "selection" && (
          <>
            <div
              className="timeline-layer-trim timeline-layer-trim-left"
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelectLayer(layer.id);
                startDrag("trimLeft", layer, event, event.currentTarget.parentElement!);
              }}
            />
            <div
              className="timeline-layer-trim timeline-layer-trim-right"
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelectLayer(layer.id);
                startDrag("trimRight", layer, event, event.currentTarget.parentElement!);
              }}
            />
          </>
        )}

        {showVideoThumbs && (
          <TimelineThumbnails
            thumbnails={thumbnailEntry?.data ?? []}
            loading={thumbnailEntry?.status === "loading"}
            clipWidth={clipWidth}
            inPoint={layer.inPoint}
            outPoint={layer.outPoint}
            sourceDuration={sourceDuration}
          />
        )}

        {showAudioWaveform && renderWaveformContent(layer, clipWidth, layerRowHeight)}

        {(!showVideoThumbs || timelineZoom < THUMBNAIL_ZOOM_THRESHOLD + 40) && (
          <span className="timeline-layer-block-label">
            {variant === "audio" ? (
              <>
                <Volume2 size={10} /> {layer.name}
              </>
            ) : (
              layer.name
            )}
          </span>
        )}
      </div>
    );
  };

  const renderAudioPropertyRow = (layer: TimelineLayer) => {
    const clipWidth = Math.max(timeToX(layerDuration(layer), timelineZoom), 8);
    return (
      <div
        className="timeline-track-row timeline-property-audio"
        style={{ height: propertyRowHeight, width: contentWidth }}
      >
        <div
          className="timeline-audio-row-content"
          style={{
            left: timeToX(layer.startTime, timelineZoom),
            width: clipWidth,
            height: propertyRowHeight,
          }}
        >
          {renderWaveformContent(layer, clipWidth, propertyRowHeight)}
        </div>
      </div>
    );
  };

  const renderPropertyRow = (row: PropertyRow, layer: TimelineLayer) => {
    switch (row.kind) {
      case "video":
        return (
          <>
            <Film size={11} /> Video
          </>
        );
      case "audio":
        return (
          <>
            {layer.audioExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <Volume2 size={11} /> Audio
          </>
        );
      case "audio-levels":
        return <>Audio Levels</>;
      case "waveform":
        return (
          <>
            <ChevronRight size={11} /> Waveform
          </>
        );
      case "transform":
        return (
          <>
            {layer.transformExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <Move size={11} /> Transform
          </>
        );
      case "keyframe-position":
        return renderKeyframePropertyLabel(layer, "position", "Position");
      case "keyframe-scale":
        return renderKeyframePropertyLabel(layer, "scale", "Scale");
      case "keyframe-rotation":
        return renderKeyframePropertyLabel(layer, "rotation", "Rotation");
      case "keyframe-opacity":
        return renderKeyframePropertyLabel(layer, "opacity", "Opacity");
      case "effect-param": {
        const effect = layer.effects?.find((entry) => entry.id === row.effectId);
        const enabled = effect
          ? isEffectParamAnimationEnabled(effect, row.param)
          : false;
        const keyCount = effect?.keyframes?.[row.param]?.keyframes.length ?? 0;
        const hasSelection = selectedKeyframes.some(
          (ref) =>
            ref.kind === "effect" &&
            ref.layerId === layer.id &&
            ref.effectId === row.effectId &&
            ref.param === row.param
        );
        return (
          <span className={`timeline-kf-property-label timeline-effect-param-label ${hasSelection ? "selected" : ""}`}>
            <Timer size={11} className={enabled ? "stopwatch-on" : "stopwatch-off"} />
            <span>{row.label}</span>
            <span className="timeline-kf-key-count">
              {keyCount} {keyCount === 1 ? "key" : "keys"}
            </span>
          </span>
        );
      }
      case "crop":
        return (
          <>
            {layer.cropExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <Crop size={11} /> Crop
          </>
        );
      case "crop-field":
        return <>{row.label}</>;
      case "effects":
        return (
          <>
            <Sparkles size={11} /> Effects
          </>
        );
      case "effect": {
        const effect = layer.effects?.find((entry) => entry.id === row.effectId);
        return (
          <>
            {effect && !effect.collapsed ? (
              <ChevronDown size={11} />
            ) : (
              <ChevronRight size={11} />
            )}
            <SlidersHorizontal size={11} /> {row.label}
          </>
        );
      }
      case "timing":
        return (
          <>
            <Clock size={11} /> Timing
          </>
        );
    }
  };

  const hasInlineEditing =
    onTransformChange &&
    onToggleTransformAnimation &&
    onToggleKeyframeDiamond &&
    onToggleEffectParamAnimation &&
    onToggleEffectParamDiamond &&
    onEffectParamChange;

  return (
    <section
      ref={timelineFocusRef}
      tabIndex={-1}
      className={`timeline-editor timeline-editor-ae ${embedded ? "embedded" : ""} ${viewMode === "tracks" ? "tracks-mode" : "layer-mode"} ${getToolCursorClass(activeTool, isSpacePanActive)}`}
      onPointerDown={focusTimeline}
    >
      <div
        className={`timeline-body ${isResizingLeftPane ? "timeline-body-resizing" : ""}`}
        style={{ gridTemplateColumns: `${leftPaneWidth}px 5px minmax(0, 1fr)` }}
        onDragOver={preventDragDefaults}
        onDrop={handleTimelineDrop}
      >
        <div className="timeline-sidebar">
          <div className="timeline-sidebar-header" style={{ height: RULER_HEIGHT }}>
            {viewMode === "tracks" ? (
              <>
                <span className="tl-col tl-col-track" title="Track">
                  Track
                </span>
                <span className="tl-col tl-col-vis" title="Visibility">
                  <Eye size={ICON_SIZE} aria-hidden />
                </span>
                <span className="tl-col tl-col-lock" title="Lock Layer">
                  <Lock size={ICON_SIZE} aria-hidden />
                </span>
                <span className="tl-col tl-col-audio" title="Audio Enabled">
                  <Volume2 size={ICON_SIZE} aria-hidden />
                </span>
                <span className="tl-col tl-col-name" title="Layer Name">
                  Name
                </span>
              </>
            ) : (
              <>
                <span className="tl-col tl-col-index" title="Layer index">
                  #
                </span>
                <span className="tl-col tl-col-vis" title="Visibility">
                  <Eye size={ICON_SIZE} aria-hidden />
                </span>
                <span className="tl-col tl-col-lock" title="Lock Layer">
                  <Lock size={ICON_SIZE} aria-hidden />
                </span>
                <span className="tl-col tl-col-audio" title="Audio Enabled">
                  <Volume2 size={ICON_SIZE} aria-hidden />
                </span>
                <span className="tl-col tl-col-disclosure" aria-hidden />
                <span className="tl-col tl-col-name" title="Layer Name">
                  Name
                </span>
              </>
            )}
          </div>

          <div
            className="timeline-sidebar-layers"
            ref={sidebarScrollRef}
            onScroll={() => {
              const scroll = scrollRef.current;
              const sidebar = sidebarScrollRef.current;
              if (scroll && sidebar) {
                scroll.scrollTop = sidebar.scrollTop;
              }
            }}
          >
            {viewMode === "tracks"
              ? trackRows.map((track) => {
                  const { layer, kind } = track;
                  return (
                    <div
                      key={`${layer.id}-${kind}`}
                      className={`timeline-layer-row timeline-track-label-row ${selectedLayerId === layer.id ? "selected" : ""} ${!layer.enabled ? "disabled" : ""}`}
                      style={{ height: layerRowHeight }}
                    >
                      <span className="tl-col tl-col-track" title={`${trackLabel(kind, layer.index)} track`}>
                        {trackLabel(kind, layer.index)}
                      </span>
                      <button
                        type="button"
                        className={`tl-toggle ${layer.enabled ? "on" : "off"}`}
                        onClick={() => toggleLayerFlag(layer, "enabled")}
                        title={layer.enabled ? "Hide layer" : "Show layer"}
                      >
                        {layer.enabled ? <Eye size={ICON_SIZE} /> : <EyeOff size={ICON_SIZE} />}
                      </button>
                      <button
                        type="button"
                        className={`tl-toggle ${layer.locked ? "on" : "off"}`}
                        onClick={() => toggleLayerFlag(layer, "locked")}
                        title={layer.locked ? "Unlock layer" : "Lock layer"}
                      >
                        {layer.locked ? <Lock size={ICON_SIZE} /> : <Unlock size={ICON_SIZE} />}
                      </button>
                      <button
                        type="button"
                        className={`tl-toggle ${!layer.muted ? "on" : "off"}`}
                        onClick={() => toggleLayerFlag(layer, "muted")}
                        title={layer.muted ? "Unmute audio" : "Mute audio"}
                        disabled={kind === "video"}
                      >
                        {layer.muted ? <VolumeX size={ICON_SIZE} /> : <Volume2 size={ICON_SIZE} />}
                      </button>
                      <button
                        type="button"
                        className={`timeline-layer-name ${isPrecompLayer(layer) ? "timeline-layer-precomp" : ""}`}
                        onClick={(event) => handleLayerSelect(layer.id, event)}
                        onDoubleClick={() => handleLayerOpen(layer)}
                        title={layer.name}
                      >
                        {isPrecompLayer(layer) ? (
                          <span className="timeline-precomp-icon" aria-hidden>
                            <CompositionIcon size={16} />
                          </span>
                        ) : kind === "video" ? (
                          <Film size={11} />
                        ) : (
                          <Volume2 size={11} />
                        )}{" "}
                        {layer.name}
                      </button>
                    </div>
                  );
                })
              : sortedLayers.map((layer) => {
              const propertyRows = resolvePropertyRows(layer);
              return (
                <div key={layer.id} className="timeline-layer-group">
                  <div
                    className={`timeline-layer-row ${selectedLayerId === layer.id ? "selected" : ""} ${!layer.enabled ? "disabled" : ""}`}
                    style={{ height: layerRowHeight }}
                  >
                    <span className="tl-col tl-col-index">{layer.index}</span>
                    <button
                      type="button"
                      className={`tl-toggle ${layer.enabled ? "on" : "off"}`}
                      onClick={() => toggleLayerFlag(layer, "enabled")}
                      title={layer.enabled ? "Hide layer" : "Show layer"}
                    >
                      {layer.enabled ? (
                        <Eye size={ICON_SIZE} />
                      ) : (
                        <EyeOff size={ICON_SIZE} />
                      )}
                    </button>
                    <button
                      type="button"
                      className={`tl-toggle ${layer.locked ? "on" : "off"}`}
                      onClick={() => toggleLayerFlag(layer, "locked")}
                      title={layer.locked ? "Unlock layer" : "Lock layer"}
                    >
                      {layer.locked ? (
                        <Lock size={ICON_SIZE} />
                      ) : (
                        <Unlock size={ICON_SIZE} />
                      )}
                    </button>
                    <button
                      type="button"
                      className={`tl-toggle ${!layer.muted ? "on" : "off"}`}
                      onClick={() => toggleLayerFlag(layer, "muted")}
                      title={layer.muted ? "Unmute audio" : "Mute audio"}
                    >
                      {layer.muted ? (
                        <VolumeX size={ICON_SIZE} />
                      ) : (
                        <Volume2 size={ICON_SIZE} />
                      )}
                    </button>
                    <button
                      type="button"
                      className="timeline-layer-disclosure"
                      onClick={() => toggleLayerFlag(layer, "collapsed")}
                      aria-expanded={!layer.collapsed}
                      title={layer.collapsed ? "Expand properties" : "Collapse properties"}
                    >
                      {layer.collapsed ? (
                        <ChevronRight size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </button>
                    <button
                      type="button"
                      className={`timeline-layer-name ${isPrecompLayer(layer) ? "timeline-layer-precomp" : ""}`}
                      onClick={(event) => handleLayerSelect(layer.id, event)}
                      onDoubleClick={() => handleLayerOpen(layer)}
                      title={layer.name}
                    >
                      {isPrecompLayer(layer) && (
                        <span className="timeline-precomp-icon" aria-hidden>
                          <CompositionIcon size={16} />
                        </span>
                      )}
                      {layer.name}
                    </button>
                  </div>

                  {propertyRows.map((row) => {
                    const rowKey = propertyRowKey(layer.id, row);
                    const rowHovered = hoveredPropertyRowKey === rowKey;
                    return hasInlineEditing ? (
                      <TimelinePropertySidebarRow
                        key={rowKey}
                        layer={layer}
                        row={row}
                        height={propertyRowHeight}
                        compCurrentTime={compCurrentTime}
                        compWidth={compWidth}
                        compHeight={compHeight}
                        highlighted={isRowHighlighted(layer, row)}
                        hovered={rowHovered}
                        rowKey={rowKey}
                        onRowHover={setHoveredPropertyRowKey}
                        onSelectLayer={onSelectLayer}
                        onToggleExpand={togglePropertyExpand}
                        onTransformChange={onTransformChange}
                        onToggleTransformAnimation={onToggleTransformAnimation}
                        onToggleKeyframeDiamond={onToggleKeyframeDiamond}
                        onToggleEffectParamAnimation={onToggleEffectParamAnimation}
                        onToggleEffectParamDiamond={onToggleEffectParamDiamond}
                        onEffectParamChange={onEffectParamChange}
                        onLayerChange={onLayerChange}
                        renderLabel={renderPropertyRow}
                      />
                    ) : (
                      <button
                        key={rowKey}
                        type="button"
                        className="timeline-layer-child"
                        style={{ height: propertyRowHeight }}
                        onClick={() => {
                          onSelectLayer(layer.id);
                          togglePropertyExpand(layer, row);
                        }}
                      >
                        <span className="timeline-layer-child-inner">
                          {renderPropertyRow(row, layer)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={`timeline-pane-divider ${isResizingLeftPane ? "dragging" : ""}`}
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={leftPaneWidth}
          title="Drag to resize layer panel"
          onPointerDown={startLeftPaneResize}
          onPointerMove={moveLeftPaneResize}
          onPointerUp={endLeftPaneResize}
          onPointerCancel={endLeftPaneResize}
        />

        <div className="timeline-tracks-panel">
          <div
            className={`timeline-scroll ${isPanMode ? "timeline-hand-scroll" : ""}`}
            ref={scrollRef}
            data-testid="timeline-scroll-area"
            onWheel={handleWheel}
            onScroll={syncSidebarScroll}
            onPointerDown={startHandPan}
          >
            <div
              className="timeline-scroll-content"
              data-testid="timeline-track-area"
              style={{ width: contentWidth }}
              onPointerDown={handleTimelineBackgroundPointerDown}
            >
              {hasRenderRange && (
                <div
                  className={`timeline-render-range-layer ${renderRange === "selectedLayer" ? "selected-layer-range" : renderRange === "workArea" ? "work-area-range" : "full-range"}`}
                  style={{ top: RULER_HEIGHT }}
                >
                  <div
                    className="timeline-render-range-shade timeline-render-range-shade-left"
                    style={{ left: 0, width: timeToX(renderRangeStart, timelineZoom) }}
                  />
                  <div
                    className="timeline-render-range-shade timeline-render-range-shade-right"
                    style={{
                      left: timeToX(renderRangeEnd, timelineZoom),
                      width: timeToX(safeDuration - renderRangeEnd, timelineZoom),
                    }}
                  />
                  <div
                    className="timeline-render-range-band"
                    style={{
                      left: timeToX(renderRangeStart, timelineZoom),
                      width: timeToX(renderRangeEnd - renderRangeStart, timelineZoom),
                    }}
                    title={`Render range: ${renderRangeStart.toFixed(2)}s – ${renderRangeEnd.toFixed(2)}s`}
                  />
                </div>
              )}

              {hasWorkArea && renderRange !== "workArea" && (
                <div className="timeline-work-area-layer" style={{ top: RULER_HEIGHT }}>
                  <div
                    className="timeline-work-area-shade timeline-work-area-shade-left"
                    style={{ left: 0, width: timeToX(workAreaLeft, timelineZoom) }}
                  />
                  <div
                    className="timeline-work-area-shade timeline-work-area-shade-right"
                    style={{
                      left: timeToX(workAreaRight, timelineZoom),
                      width: timeToX(safeDuration - workAreaRight, timelineZoom),
                    }}
                  />
                  <div
                    className="timeline-work-area-range"
                    style={{
                      left: timeToX(workAreaLeft, timelineZoom),
                      width: timeToX(workAreaRight - workAreaLeft, timelineZoom),
                    }}
                  />
                  <div
                    className="timeline-work-area-marker timeline-work-area-marker-start"
                    style={{ left: timeToX(workAreaLeft, timelineZoom) }}
                    title="Work Area Start"
                  />
                  <div
                    className="timeline-work-area-marker timeline-work-area-marker-end"
                    style={{ left: timeToX(workAreaRight, timelineZoom) }}
                    title="Work Area End"
                  />
                </div>
              )}

              <div
                className="timeline-ruler"
                data-testid="timeline-ruler"
                data-timeline-zoom={timelineZoom}
                style={{ height: RULER_HEIGHT, width: contentWidth }}
                onPointerDown={handleRulerClick}
              >
                {previewBufferState && (
                  <TimelinePreviewBufferBar
                    duration={safeDuration}
                    timelineZoom={timelineZoom}
                    bufferState={previewBufferState}
                  />
                )}
                {previewCache && (
                  <TimelinePreviewCacheBar
                    duration={safeDuration}
                    timelineZoom={timelineZoom}
                    cache={previewCache}
                  />
                )}
                {rulerMarks.map((mark) => (
                  <div
                    key={`sec-${mark}`}
                    className="timeline-ruler-mark"
                    style={{ left: timeToX(mark, timelineZoom) }}
                  >
                    <span>{mark}s</span>
                  </div>
                ))}
                {frameTicks.map((tick) => (
                  <div
                    key={`frame-${tick.time}`}
                    className={`timeline-ruler-frame-tick ${tick.isSecond ? "second" : ""}`}
                    style={{ left: timeToX(tick.time, timelineZoom) }}
                    title={
                      tick.isSecond
                        ? `${tick.time.toFixed(2)}s`
                        : `${String(tick.frameInSecond).padStart(2, "0")}f`
                    }
                  >
                    {!tick.isSecond && timelineZoom >= 500 && (
                      <span className="timeline-ruler-frame-label">
                        {String(tick.frameInSecond).padStart(2, "0")}f
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div
                className="timeline-playhead-line"
                data-testid="timeline-playhead"
                style={{ left: timeToX(safeCurrentTime, timelineZoom), top: RULER_HEIGHT }}
                onPointerDown={(event) => {
                  seekTimelineFromClientX(event.clientX);
                  if (activeTool === "selection" && sortedLayers[0]) {
                    startDrag("playhead", sortedLayers[0], event, event.currentTarget);
                  }
                }}
              />

              {viewMode === "tracks"
                ? trackRows.map((track) => {
                    const { layer, kind } = track;
                    return (
                      <div
                        key={`track-${layer.id}-${kind}`}
                        className={`timeline-track-row timeline-layer-track ${kind === "audio" ? "timeline-audio-track" : "timeline-video-track"} ${!layer.enabled ? "layer-disabled" : ""} ${layer.locked ? "layer-locked" : ""}`}
                        style={{ height: layerRowHeight, width: contentWidth }}
                      >
                        <div className="timeline-track-bg" />
                        {renderClipBlock(layer, kind)}
                      </div>
                    );
                  })
                : sortedLayers.map((layer) => {
                    const propertyRows = resolvePropertyRows(layer);
                    return (
                      <div key={layer.id} className="timeline-layer-group">
                        <div
                          className={`timeline-track-row timeline-layer-track ${!layer.enabled ? "layer-disabled" : ""} ${layer.locked ? "layer-locked" : ""}`}
                          style={{ height: layerRowHeight, width: contentWidth }}
                        >
                          <div className="timeline-track-bg" />
                          {renderClipBlock(layer)}
                        </div>

                        {propertyRows.map((row) => {
                          const rowKey = propertyRowKey(layer.id, row);
                          const trackKey = `track-${rowKey}`;
                          const rowHovered = hoveredPropertyRowKey === rowKey;
                          const rowHighlighted = isRowHighlighted(layer, row);
                          if (row.kind === "waveform" && layer.hasAudio && !layer.collapsed) {
                            return <div key={trackKey}>{renderAudioPropertyRow(layer)}</div>;
                          }
                          if (
                            row.kind === "keyframe-position" ||
                            row.kind === "keyframe-scale" ||
                            row.kind === "keyframe-rotation" ||
                            row.kind === "keyframe-opacity"
                          ) {
                            const meta = KEYFRAME_ROW_GROUPS[row.kind];
                            return (
                              <TimelineKeyframeTrack
                                key={trackKey}
                                layer={layer}
                                group={meta.group}
                                label={meta.label}
                                timelineZoom={timelineZoom}
                                propertyRowHeight={propertyRowHeight}
                                contentWidth={contentWidth}
                                fps={fps}
                                compCurrentTime={safeCurrentTime}
                                selectedKeyframes={selectedKeyframes}
                                highlighted={rowHighlighted}
                                hovered={rowHovered}
                                rowKey={rowKey}
                                onRowHover={setHoveredPropertyRowKey}
                                onSeek={onSeek}
                                onSelectKeyframe={onSelectKeyframe ?? (() => {})}
                                onMoveKeyframe={onMoveKeyframe ?? (() => {})}
                                onKeyframeDragStart={onKeyframeDragStart}
                                onKeyframeDragEnd={onKeyframeDragEnd}
                                onOpenContextMenu={onOpenKeyframeContextMenu}
                              />
                            );
                          }
                          if (row.kind === "effect-param") {
                            return (
                              <TimelineEffectKeyframeTrack
                                key={rowKey}
                                layer={layer}
                                effectId={row.effectId}
                                param={row.param}
                                label={row.label}
                                timelineZoom={timelineZoom}
                                propertyRowHeight={propertyRowHeight}
                                contentWidth={contentWidth}
                                fps={fps}
                                compCurrentTime={safeCurrentTime}
                                selectedKeyframes={selectedKeyframes}
                                onSeek={onSeek}
                                onSelectKeyframe={onSelectKeyframe ?? (() => {})}
                                onMoveEffectKeyframe={onMoveEffectKeyframe ?? (() => {})}
                                onKeyframeDragStart={onKeyframeDragStart}
                                onKeyframeDragEnd={onKeyframeDragEnd}
                                onOpenContextMenu={onOpenKeyframeContextMenu}
                              />
                            );
                          }
                          return (
                            <div
                              key={trackKey}
                              className={`timeline-track-row timeline-property-spacer ${
                                rowHighlighted ? "timeline-property-row-highlighted" : ""
                              } ${rowHovered ? "timeline-property-row-hovered" : ""}`}
                              style={{ height: propertyRowHeight, width: contentWidth }}
                              onMouseEnter={() => setHoveredPropertyRowKey(rowKey)}
                              onMouseLeave={() => setHoveredPropertyRowKey(null)}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      </div>

      <div className="timeline-footer">
        <div className="timeline-mode-toggle" role="group" aria-label="Timeline view mode">
          <span className="timeline-footer-label">Mode</span>
          <button
            type="button"
            className={`timeline-mode-btn ${viewMode === "layer" ? "active" : ""}`}
            onClick={() => onViewModeChange?.("layer")}
            title="Layer Mode (After Effects style)"
          >
            <Layers size={12} /> Layer
          </button>
          <button
            type="button"
            className={`timeline-mode-btn ${viewMode === "tracks" ? "active" : ""}`}
            onClick={() => onViewModeChange?.("tracks")}
            title="Tracks Mode (NLE style)"
          >
            <Film size={12} /> Tracks
          </button>
        </div>

        <div className="timeline-footer-zoom-group">
          <span className="timeline-footer-label">H Zoom</span>
          <button
            type="button"
            className="timeline-zoom-btn"
            onClick={zoomOut}
            title="Zoom Out (horizontal)"
            aria-label="Zoom Out horizontal"
          >
            −
          </button>
          <input
            type="range"
            className="timeline-zoom-slider"
            min={MIN_TIMELINE_ZOOM}
            max={MAX_TIMELINE_ZOOM}
            step={0.5}
            value={timelineZoom}
            onChange={(e) => setManualZoom(parseFloat(e.target.value))}
            title={`Horizontal zoom: ${Math.round(timelineZoom)} px/sec`}
          />
          <button
            type="button"
            className="timeline-zoom-btn"
            onClick={zoomIn}
            title="Zoom In (horizontal)"
            aria-label="Zoom In horizontal"
          >
            +
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm timeline-fit-btn"
            onClick={fitTimeline}
            title="Fit Timeline to Composition"
          >
            Fit
          </button>
        </div>

        <div className="timeline-footer-zoom-group">
          <span className="timeline-footer-label">V Zoom</span>
          <button
            type="button"
            className="timeline-zoom-btn"
            onClick={zoomOutY}
            title="Decrease track height"
            aria-label="Decrease track height"
          >
            −
          </button>
          <input
            type="range"
            className="timeline-zoom-slider timeline-zoom-slider-y"
            min={MIN_TIMELINE_ZOOM_Y}
            max={MAX_TIMELINE_ZOOM_Y}
            step={0.05}
            value={timelineZoomY}
            onChange={(e) => setManualZoomY(parseFloat(e.target.value))}
            title={`Vertical zoom: ${Math.round(timelineZoomY * 100)}%`}
          />
          <button
            type="button"
            className="timeline-zoom-btn"
            onClick={zoomInY}
            title="Increase track height"
            aria-label="Increase track height"
          >
            +
          </button>
        </div>

        <span className="timeline-footer-time">{formatTimecode(safeCurrentTime)}</span>
      </div>
    </section>
  );
}

export default memo(TimelineEditor);
