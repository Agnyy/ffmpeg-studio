import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StudioLayout from "./components/StudioLayout";
import type { VideoPreviewHandle } from "./components/videoPreviewHandle";
import type { BottomTab } from "./components/BottomDock";
import type { RightDockTab } from "./components/RightDock";
import type { LeftDockTab } from "./components/LeftDock";
import {
  NORMAL_TIMELINE_REVEAL,
  type RevealedProperty,
  type TimelineRevealState,
} from "./utils/timelinePropertyReveal";
import { buildPreviewCacheArgs } from "../ffmpeg/previewCacheBuilder";
import {
  computePreviewCacheFingerprint,
  EMPTY_PREVIEW_CACHE,
  type PreviewCacheState,
} from "../shared/previewCache";
import {
  EMPTY_PREVIEW_BUFFER_STATE,
  type PreviewBufferState,
} from "../shared/previewBufferedRanges";
import type { LayerEffect } from "../shared/effects";
import { getEffectParamDefinitions } from "../keyframes/effectKeyframes";
import { isEffectParamAnimationEnabled } from "../keyframes/layerEffectKeyframes";
import type { TimelineViewMode } from "./utils/timelineZoom";
import {
  EMPTY_PLAYBACK_DIAGNOSTICS,
  type PlaybackDiagnostics,
} from "./types/playbackDiagnostics";
import { buildPreviewProxyArgs } from "../ffmpeg/previewProxyBuilder";
import { buildVidstabDetectArgs } from "../ffmpeg/catalogEffectFilters";
import {
  createCompositionRenderJob,
  createEditClipJob,
  createPreviewCacheJob,
  createProxyJob,
  createVidstabAnalysisJob,
} from "../jobs/jobFactory";
import { createBatchPassthroughRenderJobForItem, createBatchRenderJobForItem } from "../batch/batchCompositionBuilder";
import {
  buildBatchOutputPath,
  resolveUniqueOutputPath,
} from "../batch/batchOutputNaming";
import { getBatchRecipeBlockReason } from "../batch/batchRecipes";
import { applyFilterRecipe } from "../effects/applyFilterRecipe";
import { getFilterRecipeById } from "../effects/filterRecipes";
import BatchApplyRecipeDialog, {
  type BatchApplyOptions,
} from "./components/BatchApplyRecipeDialog";
import type { ProjectItemSelectModifiers } from "./components/ProjectPanel";
import { getRunningJobSummary } from "../jobs/jobUtils";
import { useAppStartup } from "./hooks/useAppStartup";
import StartupOverlay from "./components/StartupOverlay";
import { useBackgroundJobQueue } from "./hooks/useBackgroundJobQueue";
import {
  buildCompositionOutputPath,
  buildCompositionRenderArgs,
  formatRenderRangeLabel,
  resolveRenderRange,
} from "../ffmpeg/compositionRenderBuilder";
import {
  buildPrecompRenderPlan,
  collectPrecompRenderWarnings,
} from "../ffmpeg/precompRenderPlanner";
import { layerToEditOptionsFromLayer } from "../ffmpeg/editCommandBuilder";
import { createDefaultCrop, type CropRect } from "../shared/clipEdit";
import {
  captureActiveCompRuntime,
  emptyCompRuntime,
  migrateCompositionName,
  nextCompositionName,
  type CompRuntimeState,
} from "../shared/compRuntime";
import CompositionSettingsDialog, {
  compositionMetaToSettings,
  type CompositionSettingsValues,
} from "./components/CompositionSettingsDialog";
import CreateCompFromFootageDialog from "./components/CreateCompFromFootageDialog";
import {
  createCompositionItem,
  createPrecompLayer,
  createProjectId,
  createTimelineLayer,
  isPrecompLayer,
  ensureLayerTransform,
  layerCompEnd,
  reindexLayers,
  updateCompositionDuration,
  type ImportSource,
  type ProjectItem,
  type TimelineLayer,
} from "../shared/project";
import { getBasename } from "../shared/pathUtils";
import { filterVideoPaths } from "./utils/mediaFiles";
import {
  createFootageProjectItem,
  getSafePreviewPathForItem,
} from "../media/mediaCompatibility";
import {
  clearNativePreviewCacheForPath,
  markNativePreviewFailed,
} from "../media/nativePreviewCache";
import {
  applyChromiumQuarantine,
  canRetryChromiumPreview,
  resetChromiumPreviewForRetry,
} from "../media/chromiumQuarantine";
import {
  chromiumFailImportPatch,
  chromiumOkImportPatch,
  engineImportPreviewPatch,
  runNativePreviewCheck,
} from "../media/mediaPostImport";
import { PREVIEW_ENGINE_ENABLED } from "../shared/previewEngineConfig";
import { findProxyJobForItem } from "../media/previewState";
import {
  extractThumbnailDataUrl,
  fetchProjectItemThumbnailDataUrl,
} from "../media/thumbnailDebugPipe";
import { useCommandShortcuts, type CommandHandlers } from "./hooks/useCommandShortcuts";
import { useSpacePan } from "./hooks/useSpacePan";
import { usePreviewE2eBootstrap } from "./previewE2e/usePreviewE2eBootstrap";
import { useRenderCount } from "./hooks/useRenderCount";
import { PLAYBACK_TIME_NOTIFY_MS } from "./perf/playbackTimeThrottle";
import {
  duplicateTimelineLayer,
  moveLayerEndToPlayhead,
  moveLayerInStack,
  moveLayerStartToPlayhead,
  splitLayerAtTime,
  trimLayerInToPlayhead,
  trimLayerOutToPlayhead,
} from "./commands/layerCommands";
import { useMediaVisualCache } from "./hooks/useMediaVisualCache";
import type { EditorTool } from "../tools/toolTypes";
import { DEFAULT_EDITOR_TOOL } from "../tools/toolTypes";
import {
  createInitialProjectMeta,
  rebuildEditorFromFlat,
  useProjectDocument,
} from "./hooks/useProjectDocument";
import {
  attachThumbnailsToItems,
  createDefaultFlatEditorState,
  flatFromAppState,
  flatFromLoadedProject,
  mediaDimensionsFromItems,
  probeLoadedMedia,
  relinkFootageInState,
  validateMediaItems,
} from "./projectPersistence";
import {
  DEFAULT_EXPORT_SETTINGS,
  type ExportSettings,
  type FlatEditorState,
  type FFmpegStudioProject,
} from "../shared/projectDocument";
import type { MenuAction } from "../main/menu";
import { resetTransform } from "./utils/layerTransform";
import { frameDuration } from "./utils/time";
import { logAppSeek } from "./utils/timelineSeekDebug";
import type { RenderRange } from "../shared/projectDocument";
import { createLayerEffect, type LayerEffectType } from "../shared/effects";
import type { TransformGroupKey, TransformPropertyKey } from "../keyframes/keyframeTypes";
import {
  applyTransformPatchWithKeyframes,
  findAdjacentKeyframeTime,
  toggleKeyframeDiamondAtTime,
  toggleTransformGroupAnimation,
} from "../keyframes/layerTransformKeyframes";
import {
  buildKeyframeClipboard,
  deleteSelectedKeyframesFromLayers,
  moveSelectedEffectKeyframe,
  pasteKeyframeClipboard,
  setSelectedKeyframesInterpolation,
} from "../keyframes/keyframeClipboard";
import {
  applyLayerEffectParamPatch,
  toggleEffectParamAnimation,
  toggleEffectParamDiamondAtTime,
} from "../keyframes/layerEffectKeyframes";
import type { KeyframeInterpolation } from "../keyframes/keyframeTypes";
import { moveKeyframeTime } from "../keyframes/keyframeUtils";
import type { KeyframeClipboard, SelectedKeyframeRef } from "../keyframes/keyframeSelection";
import { refsMatch } from "../keyframes/keyframeSelection";
import type { KeyframeContextMenuState } from "./components/KeyframeContextMenu";
import type { LayerTransform } from "../shared/transform";
import type { FfmpegResolveResult, Job, MediaInfo } from "../shared/types";

export default function App() {
  useRenderCount("App");

  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegResolveResult | null>(null);
  const [projectItems, setProjectItems] = useState<ProjectItem[]>([]);
  const [timelineLayers, setTimelineLayers] = useState<TimelineLayer[]>([]);
  const projectItemsRef = useRef(projectItems);
  const timelineLayersRef = useRef(timelineLayers);
  projectItemsRef.current = projectItems;
  timelineLayersRef.current = timelineLayers;
  const [activeCompositionId, setActiveCompositionId] = useState<string | null>(null);
  const [selectedProjectItemId, setSelectedProjectItemId] = useState<string | null>(null);
  const [selectedProjectItemIds, setSelectedProjectItemIds] = useState<string[]>([]);
  const [batchApplyDialogOpen, setBatchApplyDialogOpen] = useState(false);
  const [compStatesById, setCompStatesById] = useState<Record<string, CompRuntimeState>>({});
  const [compositionSettingsTargetId, setCompositionSettingsTargetId] = useState<
    string | null
  >(null);
  const [createCompFromFootageTarget, setCreateCompFromFootageTarget] =
    useState<ProjectItem | null>(null);
  const startup = useAppStartup();
  const { availableNames } = startup;
  const [startupOverlayFading, setStartupOverlayFading] = useState(false);
  const prevStartupStageRef = useRef(startup.stage);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [compNavStack, setCompNavStack] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [compCurrentTime, setCompCurrentTime] = useState(0);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    ...DEFAULT_EXPORT_SETTINGS,
  });
  const [mediaMap, setMediaMap] = useState<
    Record<string, { mediaInfo?: MediaInfo; probeError?: string }>
  >({});
  const [isRunning, setIsRunning] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewBackend, setPreviewBackend] = useState<
    import("../shared/types").PreviewBackendSetting
  >("chromium-video");
  const [commandPreview, setCommandPreview] = useState("");
  const [commandPreviewNote, setCommandPreviewNote] = useState("");
  const [bottomTab, setBottomTab] = useState<BottomTab>("comp");
  const [seekTime, setSeekTime] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loopPlayback, setLoopPlayback] = useState(false);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [importError, setImportError] = useState<string | null>(null);
  const [previewErrorsByPath, setPreviewErrorsByPath] = useState<Record<string, string>>({});
  const [rightDockTab, setRightDockTab] = useState<RightDockTab>("effects");
  const [leftDockTab, setLeftDockTab] = useState<LeftDockTab>("project");
  const [timelineRevealState, setTimelineRevealState] =
    useState<TimelineRevealState>(NORMAL_TIMELINE_REVEAL);
  const [previewCache, setPreviewCache] = useState<PreviewCacheState>(EMPTY_PREVIEW_CACHE);
  const [previewBufferState, setPreviewBufferState] =
    useState<PreviewBufferState>(EMPTY_PREVIEW_BUFFER_STATE);
  const [useCachedPreview, setUseCachedPreview] = useState(false);
  const thumbnailInFlightIds = useRef(new Set<string>());
  const [timelineViewMode, setTimelineViewMode] = useState<TimelineViewMode>("layer");
  const [activeTool, setActiveTool] = useState<EditorTool>(DEFAULT_EDITOR_TOOL);
  const [workAreaStart, setWorkAreaStart] = useState(0);
  const [workAreaEnd, setWorkAreaEnd] = useState(0);
  const [renderRange, setRenderRange] = useState<RenderRange>("full");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [selectedKeyframes, setSelectedKeyframes] = useState<SelectedKeyframeRef[]>([]);
  const [keyframeClipboard, setKeyframeClipboard] = useState<KeyframeClipboard | null>(null);
  const [keyframeContextMenu, setKeyframeContextMenu] = useState<KeyframeContextMenuState>(null);
  const [playbackDiagnostics, setPlaybackDiagnostics] = useState<PlaybackDiagnostics>(
    EMPTY_PLAYBACK_DIAGNOSTICS
  );

  const initialProjectMeta = useMemo(() => createInitialProjectMeta(), []);
  const projectDoc = useProjectDocument(initialProjectMeta);
  const isDraggingHistoryRef = useRef(false);
  const isPlayingRef = useRef(false);
  const compCurrentTimeRef = useRef(0);
  const lastAppTimeNotifyMsRef = useRef(0);
  const startupCheckedRef = useRef(false);
  const statusTimeoutRef = useRef<number | null>(null);

  const videoPreviewRef = useRef<VideoPreviewHandle>(null!);
  const cropEditSnapshotRef = useRef<{
    layerId: string;
    cropEnabled: boolean;
    crop: CropRect | undefined;
  } | null>(null);
  const precompCleanupByParentJobRef = useRef<Record<string, string[]>>({});
  const mediaVisualCache = useMediaVisualCache();

  const refreshFfmpegStatus = useCallback(async () => {
    const result = await window.ffmpegStudio.resolveFfmpeg();
    setFfmpegStatus(result);
    return result;
  }, []);

  const refreshAppSettings = useCallback(async () => {
    const settings = await window.ffmpegStudio.getSettings();
    setPreviewBackend(settings.previewBackend ?? "chromium-video");
    return settings;
  }, []);

  useEffect(() => {
    if (startup.ffmpegStatus) {
      setFfmpegStatus(startup.ffmpegStatus);
    }
  }, [startup.ffmpegStatus]);

  useEffect(() => {
    void refreshAppSettings();
  }, [refreshAppSettings]);

  useEffect(() => {
    const unsubLog = window.ffmpegStudio.onJobLog(({ jobId, line }) => {
      setLogLines((prev) => [...prev, line]);
      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId ? { ...job, log: [...job.log, line] } : job
        )
      );
    });

    const unsubProgress = window.ffmpegStudio.onJobProgress(
      ({ jobId, progress, indeterminate }) => {
        if (!indeterminate) {
          setJobs((prev) =>
            prev.map((job) =>
              job.id === jobId ? { ...job, progress } : job
            )
          );
        }
      }
    );

    const unsubStatus = window.ffmpegStudio.onJobStatus(({ jobId, status, error }) => {
      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId ? { ...job, status, error } : job
        )
      );
    });

    return () => {
      unsubLog();
      unsubProgress();
      unsubStatus();
    };
  }, []);

  const activeComposition = useMemo(
    () =>
      projectItems.find(
        (item) =>
          item.id === activeCompositionId && item.type === "composition"
      ) ??
      projectItems.find((item) => item.type === "composition") ??
      null,
    [projectItems, activeCompositionId]
  );

  const compWidth = activeComposition?.composition?.width ?? 1280;
  const compHeight = activeComposition?.composition?.height ?? 720;

  const selectedLayer =
    timelineLayers.find((layer) => layer.id === selectedLayerId) ?? null;

  const selectedFootage = useMemo(() => {
    if (selectedProjectItemId) {
      const item = projectItems.find((entry) => entry.id === selectedProjectItemId);
      if (item?.type === "footage" && item.path) {
        return item;
      }
    }
    if (selectedLayer) {
      return projectItems.find(
        (item) => item.type === "footage" && item.path === selectedLayer.sourcePath
      );
    }
    const firstLayer = timelineLayers[0];
    if (firstLayer) {
      return projectItems.find(
        (item) => item.type === "footage" && item.path === firstLayer.sourcePath
      );
    }
    return projectItems.find((item) => item.type === "footage") ?? null;
  }, [projectItems, selectedProjectItemId, selectedLayer, timelineLayers]);

  const selectedInputPath = selectedFootage?.path ?? null;

  const selectedJob =
    jobs.find((job) => job.id === selectedJobId) ??
    (selectedInputPath
      ? jobs.find((job) => job.inputPath === selectedInputPath && job.status !== "done")
      : null) ??
    jobs[0] ??
    null;

  const compositionDuration = useMemo(() => {
    const fromLayers = timelineLayers.reduce(
      (max, layer) => Math.max(max, layerCompEnd(layer)),
      0
    );
    return (
      fromLayers ||
      activeComposition?.composition?.duration ||
      selectedFootage?.mediaInfo?.durationSeconds ||
      0
    );
  }, [timelineLayers, activeComposition, selectedFootage]);

  const fps = selectedFootage?.mediaInfo?.fps ?? activeComposition?.composition?.fps ?? 30;
  const minLayerDuration = frameDuration(fps);

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      statusTimeoutRef.current = null;
    }, 2000);
  }, []);

  const getFlatState = useCallback(
    () => {
      const mergedCompStates = captureActiveCompRuntime({
        activeCompositionId,
        timelineLayers,
        compCurrentTime,
        workAreaStart,
        workAreaEnd,
        selectedLayerId,
        compStatesById,
      });
      return flatFromAppState({
        projectItems,
        timelineLayers,
        compCurrentTime,
        activeCompositionId,
        selectedLayerId,
        selectedProjectItemId,
        exportSettings: {
          ...exportSettings,
          renderRange,
        },
        compositionDuration,
        workAreaStart,
        workAreaEnd,
        compStatesById: mergedCompStates,
      });
    },
    [
      projectItems,
      timelineLayers,
      compCurrentTime,
      activeCompositionId,
      selectedLayerId,
      selectedProjectItemId,
      exportSettings,
      compositionDuration,
      workAreaStart,
      workAreaEnd,
      renderRange,
      compStatesById,
    ]
  );

  const recordHistory = useCallback(
    (overrides?: Partial<ReturnType<typeof getFlatState>>) => {
      if (isDraggingHistoryRef.current) {
        return;
      }
      projectDoc.pushHistory({ ...getFlatState(), ...overrides });
    },
    [getFlatState, projectDoc]
  );

  const sourceDurations = useMemo(() => {
    const map: Record<string, number> = {};
    for (const layer of timelineLayers) {
      map[layer.sourcePath] =
        mediaMap[layer.sourcePath]?.mediaInfo?.durationSeconds ??
        layer.outPoint;
    }
    return map;
  }, [timelineLayers, mediaMap]);

  useEffect(() => {
    setTimelineLayers((prev) => {
      let changed = false;
      const next = prev.map((layer) => {
        if (!layer.transform) {
          changed = true;
          return ensureLayerTransform(layer, compWidth, compHeight);
        }
        return layer;
      });
      return changed ? next : prev;
    });
  }, [compWidth, compHeight]);

  const updateCompositionFromLayers = useCallback(
    (layers: TimelineLayer[]) => {
      if (!activeCompositionId) {
        return;
      }
      const maxEnd = layers.reduce((max, layer) => Math.max(max, layerCompEnd(layer)), 0);
      if (maxEnd > 0) {
        setProjectItems((prev) =>
          prev.map((item) =>
            item.type === "composition" && item.id === activeCompositionId
              ? updateCompositionDuration(item, maxEnd)
              : item
          )
        );
      }
    },
    [activeCompositionId]
  );

  const switchComposition = useCallback(
    (compId: string, options?: { skipHistory?: boolean }) => {
      const comp = projectItems.find(
        (item) => item.id === compId && item.type === "composition"
      );
      if (!comp) {
        return;
      }

      if (compId === activeCompositionId) {
        setBottomTab("comp");
        setSelectedProjectItemId(compId);
        setSelectedProjectItemIds([compId]);
        return;
      }

      const nextStates = captureActiveCompRuntime({
        activeCompositionId,
        timelineLayers,
        compCurrentTime,
        workAreaStart,
        workAreaEnd,
        selectedLayerId,
        compStatesById,
      });

      const runtime =
        nextStates[compId] ?? emptyCompRuntime(comp.composition?.duration ?? 10);

      setCompStatesById(nextStates);
      setActiveCompositionId(compId);
      setTimelineLayers(runtime.layers);
      setCompCurrentTime(runtime.currentTime);
      setWorkAreaStart(runtime.workAreaStart);
      setWorkAreaEnd(runtime.workAreaEnd || comp.composition?.duration || 10);
      setSelectedLayerId(runtime.selectedLayerId);
      setSelectedLayerIds(runtime.selectedLayerId ? [runtime.selectedLayerId] : []);
      setSelectedProjectItemId(compId);
      setSelectedProjectItemIds([compId]);
      setBottomTab("comp");
      setIsPlaying(false);

      if (!options?.skipHistory) {
        recordHistory({
          timelineLayers: runtime.layers,
          compCurrentTime: runtime.currentTime,
          activeCompositionId: compId,
          selectedLayerId: runtime.selectedLayerId,
          selectedProjectItemId: compId,
          workAreaStart: runtime.workAreaStart,
          workAreaEnd: runtime.workAreaEnd || comp.composition?.duration || 10,
          compStatesById: nextStates,
        });
      }
    },
    [
      activeCompositionId,
      compCurrentTime,
      compStatesById,
      projectItems,
      recordHistory,
      selectedLayerId,
      timelineLayers,
      workAreaEnd,
      workAreaStart,
    ]
  );

  const handleOpenComposition = useCallback(
    (compId: string) => {
      setCompNavStack([]);
      switchComposition(compId);
    },
    [switchComposition]
  );

  const handleOpenPrecompLayer = useCallback(
    (compId: string) => {
      if (activeCompositionId && activeCompositionId !== compId) {
        setCompNavStack((prev) => [...prev, activeCompositionId]);
      }
      switchComposition(compId, { skipHistory: true });
    },
    [activeCompositionId, switchComposition]
  );

  const handleNavigateCompBack = useCallback(() => {
    setCompNavStack((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const next = [...prev];
      const parentId = next.pop();
      if (parentId) {
        switchComposition(parentId, { skipHistory: true });
      }
      return next;
    });
  }, [switchComposition]);

  const handleNavigateCompositionBreadcrumb = useCallback(
    (compId: string) => {
      setCompNavStack((prev) => {
        const index = prev.indexOf(compId);
        if (index < 0) {
          setCompNavStack([]);
          switchComposition(compId, { skipHistory: true });
          return [];
        }
        switchComposition(compId, { skipHistory: true });
        return prev.slice(0, index);
      });
    },
    [switchComposition]
  );

  const compBreadcrumbs = useMemo(() => {
    const crumbs: { id: string; name: string }[] = [];
    for (const id of compNavStack) {
      const item = projectItems.find(
        (entry) => entry.id === id && entry.type === "composition"
      );
      if (item) {
        crumbs.push({ id: item.id, name: item.name });
      }
    }
    if (activeComposition) {
      crumbs.push({ id: activeComposition.id, name: activeComposition.name });
    }
    return crumbs;
  }, [activeComposition, compNavStack, projectItems]);

  const getLayersForComposition = useCallback(
    (compositionId: string) => {
      if (compositionId === activeCompositionId) {
        return timelineLayers;
      }
      return compStatesById[compositionId]?.layers ?? [];
    },
    [activeCompositionId, compStatesById, timelineLayers]
  );

  const createCompositionFromFootage = useCallback(
    (footage: ProjectItem) => {
      if (footage.type !== "footage" || !footage.path) {
        return;
      }
      const mediaInfo = footage.mediaInfo;
      const duration = mediaInfo?.durationSeconds ?? 10;
      const comp = createCompositionItem(mediaInfo, nextCompositionName(projectItems));
      const compW = comp.composition?.width ?? 1280;
      const compH = comp.composition?.height ?? 720;
      const layer = createTimelineLayer(
        footage.id,
        footage.path,
        footage.name,
        duration,
        1,
        compW,
        compH,
        0
      );
      if (mediaInfo?.width && mediaInfo?.height) {
        layer.crop = createDefaultCrop(mediaInfo.width, mediaInfo.height);
      }
      const updatedComp = updateCompositionDuration(comp, layerCompEnd(layer));
      const nextStates = captureActiveCompRuntime({
        activeCompositionId,
        timelineLayers,
        compCurrentTime,
        workAreaStart,
        workAreaEnd,
        selectedLayerId,
        compStatesById,
      });
      nextStates[updatedComp.id] = {
        layers: [layer],
        currentTime: 0,
        workAreaStart: 0,
        workAreaEnd: duration,
        selectedLayerId: layer.id,
      };
      const nextItems = [...projectItems, updatedComp];
      setProjectItems(nextItems);
      setCompStatesById(nextStates);
      setActiveCompositionId(updatedComp.id);
      setTimelineLayers([layer]);
      setCompCurrentTime(0);
      setWorkAreaStart(0);
      setWorkAreaEnd(duration);
      setSelectedLayerId(layer.id);
      setSelectedProjectItemId(updatedComp.id);
      setSelectedProjectItemIds([updatedComp.id]);
      setBottomTab("comp");
      setIsPlaying(false);
      recordHistory({
        projectItems: nextItems,
        timelineLayers: [layer],
        compCurrentTime: 0,
        activeCompositionId: updatedComp.id,
        selectedLayerId: layer.id,
        selectedProjectItemId: updatedComp.id,
        workAreaStart: 0,
        workAreaEnd: duration,
        compStatesById: nextStates,
      });
      showStatus(`Created ${updatedComp.name}`);
    },
    [
      activeCompositionId,
      compCurrentTime,
      compStatesById,
      projectItems,
      recordHistory,
      selectedLayerId,
      showStatus,
      timelineLayers,
      workAreaEnd,
      workAreaStart,
    ]
  );

  const handleNewComposition = useCallback(() => {
    const selectedFootage =
      selectedProjectItemIds.length === 1
        ? projectItems.find(
            (item) =>
              item.id === selectedProjectItemIds[0] &&
              item.type === "footage" &&
              !item.missing
          )
        : null;
    if (selectedFootage) {
      setCreateCompFromFootageTarget(selectedFootage);
      return;
    }

    const comp = createCompositionItem(undefined, nextCompositionName(projectItems));
    const duration = comp.composition?.duration ?? 10;
    const nextStates = captureActiveCompRuntime({
      activeCompositionId,
      timelineLayers,
      compCurrentTime,
      workAreaStart,
      workAreaEnd,
      selectedLayerId,
      compStatesById,
    });
    nextStates[comp.id] = emptyCompRuntime(duration);
    const nextItems = [...projectItems, comp];
    setProjectItems(nextItems);
    setCompStatesById(nextStates);
    setActiveCompositionId(comp.id);
    setTimelineLayers([]);
    setCompCurrentTime(0);
    setWorkAreaStart(0);
    setWorkAreaEnd(duration);
    setSelectedLayerId(null);
    setSelectedProjectItemId(comp.id);
    setSelectedProjectItemIds([comp.id]);
    setBottomTab("comp");
    setIsPlaying(false);
    recordHistory({
      projectItems: nextItems,
      timelineLayers: [],
      compCurrentTime: 0,
      activeCompositionId: comp.id,
      selectedLayerId: null,
      selectedProjectItemId: comp.id,
      workAreaStart: 0,
      workAreaEnd: duration,
      compStatesById: nextStates,
    });
    showStatus(`Created ${comp.name}`);
  }, [
    activeCompositionId,
    compCurrentTime,
    compStatesById,
    projectItems,
    recordHistory,
    selectedLayerId,
    selectedProjectItemIds,
    showStatus,
    timelineLayers,
    workAreaEnd,
    workAreaStart,
  ]);

  const handleCompositionSettingsSave = useCallback(
    (values: CompositionSettingsValues) => {
      if (!compositionSettingsTargetId) {
        return;
      }
      const targetId = compositionSettingsTargetId;
      setProjectItems((prev) =>
        prev.map((item) => {
          if (item.id !== targetId || item.type !== "composition") {
            return item;
          }
          return {
            ...item,
            name: values.name,
            composition: {
              width: values.width,
              height: values.height,
              fps: values.fps,
              duration: values.duration,
            },
          };
        })
      );

      const renamePrecompLayers = (layers: TimelineLayer[]) =>
        layers.map((layer) =>
          layer.sourceCompositionId === targetId
            ? { ...layer, name: values.name }
            : layer
        );

      setTimelineLayers((prev) => renamePrecompLayers(prev));
      setCompStatesById((prev) => {
        const next: Record<string, CompRuntimeState> = {};
        for (const [id, runtime] of Object.entries(prev)) {
          next[id] = { ...runtime, layers: renamePrecompLayers(runtime.layers) };
        }
        return next;
      });

      if (targetId === activeCompositionId) {
        setWorkAreaEnd(values.duration);
      }
      setCompositionSettingsTargetId(null);
      recordHistory();
      showStatus(`Updated ${values.name}`);
    },
    [activeCompositionId, compositionSettingsTargetId, recordHistory, showStatus]
  );

  const cloneLayersWithNewIds = useCallback((layers: TimelineLayer[]) => {
    return layers.map((layer) => ({
      ...duplicateTimelineLayer(layer),
      name: layer.name,
    }));
  }, []);

  const handleDuplicateComposition = useCallback(
    (compId: string) => {
      const source = projectItems.find(
        (item) => item.id === compId && item.type === "composition"
      );
      if (!source?.composition) {
        return;
      }

      const nextStates = captureActiveCompRuntime({
        activeCompositionId,
        timelineLayers,
        compCurrentTime,
        workAreaStart,
        workAreaEnd,
        selectedLayerId,
        compStatesById,
      });
      const sourceRuntime =
        compId === activeCompositionId
          ? {
              layers: timelineLayers,
              currentTime: compCurrentTime,
              workAreaStart,
              workAreaEnd,
              selectedLayerId,
            }
          : (nextStates[compId] ?? emptyCompRuntime(source.composition.duration));

      const newComp = createCompositionItem(undefined, nextCompositionName(projectItems));
      const clonedLayers = cloneLayersWithNewIds(sourceRuntime.layers);
      const nestedDuration = clonedLayers.reduce(
        (max, layer) => Math.max(max, layerCompEnd(layer)),
        source.composition.duration
      );
      const updatedComp: ProjectItem = {
        ...newComp,
        composition: {
          ...source.composition,
          duration: Math.max(source.composition.duration, nestedDuration),
        },
      };

      nextStates[updatedComp.id] = {
        layers: clonedLayers,
        currentTime: 0,
        workAreaStart: 0,
        workAreaEnd: Math.max(source.composition.duration, nestedDuration),
        selectedLayerId: clonedLayers[0]?.id ?? null,
      };

      const nextItems = [...projectItems, updatedComp];
      setProjectItems(nextItems);
      setCompStatesById(nextStates);
      switchComposition(updatedComp.id);
      recordHistory({
        projectItems: nextItems,
        compStatesById: nextStates,
        activeCompositionId: updatedComp.id,
      });
      showStatus(`Duplicated ${source.name} → ${updatedComp.name}`);
    },
    [
      activeCompositionId,
      cloneLayersWithNewIds,
      compCurrentTime,
      compStatesById,
      projectItems,
      recordHistory,
      selectedLayerId,
      showStatus,
      switchComposition,
      timelineLayers,
      workAreaEnd,
      workAreaStart,
    ]
  );

  const handleRenameComposition = useCallback(
    (compId: string) => {
      const source = projectItems.find(
        (item) => item.id === compId && item.type === "composition"
      );
      if (!source) {
        return;
      }
      const nextName = window.prompt("Rename composition", source.name)?.trim();
      if (!nextName || nextName === source.name) {
        return;
      }
      const nextItems = projectItems.map((item) =>
        item.id === compId ? { ...item, name: nextName } : item
      );
      setProjectItems(nextItems);
      recordHistory({ projectItems: nextItems });
      showStatus(`Renamed composition to ${nextName}`);
    },
    [projectItems, recordHistory, showStatus]
  );

  const handleDeleteComposition = useCallback(
    (compId: string) => {
      const compItems = projectItems.filter((item) => item.type === "composition");
      if (compItems.length <= 1) {
        showStatus("Cannot delete the only composition");
        return;
      }

      const referencingComps = projectItems
        .filter((item) => item.type === "composition" && item.id !== compId)
        .filter((item) => {
          const runtime =
            item.id === activeCompositionId
              ? { layers: timelineLayers }
              : compStatesById[item.id];
          return runtime?.layers.some((layer) => layer.sourceCompositionId === compId);
        })
        .map((item) => item.name);

      const nextItems = projectItems.filter((item) => item.id !== compId);
      const capturedStates = captureActiveCompRuntime({
        activeCompositionId,
        timelineLayers,
        compCurrentTime,
        workAreaStart,
        workAreaEnd,
        selectedLayerId,
        compStatesById,
      });
      const nextStates = { ...capturedStates };
      delete nextStates[compId];
      for (const [id, runtime] of Object.entries(nextStates)) {
        nextStates[id] = {
          ...runtime,
          layers: runtime.layers.filter(
            (layer) => layer.sourceCompositionId !== compId
          ),
        };
      }

      setProjectItems(nextItems);
      setCompStatesById(nextStates);
      setCompNavStack((prev) => prev.filter((id) => id !== compId && nextItems.some((item) => item.id === id)));

      if (activeCompositionId === compId) {
        const fallback = nextItems.find((item) => item.type === "composition");
        if (fallback) {
          const runtime =
            nextStates[fallback.id] ?? emptyCompRuntime(fallback.composition?.duration ?? 10);
          setActiveCompositionId(fallback.id);
          setTimelineLayers(runtime.layers);
          setCompCurrentTime(runtime.currentTime);
          setWorkAreaStart(runtime.workAreaStart);
          setWorkAreaEnd(runtime.workAreaEnd);
          setSelectedLayerId(runtime.selectedLayerId);
          setSelectedProjectItemId(fallback.id);
          setSelectedProjectItemIds([fallback.id]);
        }
      }

      if (activeCompositionId !== compId) {
        const activeRuntime = nextStates[activeCompositionId ?? ""];
        if (activeRuntime) {
          setTimelineLayers(activeRuntime.layers);
          setSelectedLayerId(activeRuntime.selectedLayerId);
          setSelectedLayerIds(
            activeRuntime.selectedLayerId ? [activeRuntime.selectedLayerId] : []
          );
        }
      }

      recordHistory({
        projectItems: nextItems,
        compStatesById: nextStates,
        timelineLayers:
          activeCompositionId !== compId
            ? nextStates[activeCompositionId ?? ""]?.layers
            : undefined,
        activeCompositionId:
          activeCompositionId === compId
            ? nextItems.find((item) => item.type === "composition")?.id ?? null
            : activeCompositionId,
      });
      if (referencingComps.length > 0) {
        showStatus(
          `Composition deleted. Removed precomp references in: ${referencingComps.join(", ")}`
        );
      } else {
        showStatus("Composition deleted");
      }
    },
    [
      activeCompositionId,
      compCurrentTime,
      compStatesById,
      projectItems,
      recordHistory,
      selectedLayerId,
      showStatus,
      timelineLayers,
      workAreaEnd,
      workAreaStart,
    ]
  );

  const handlePrecompose = useCallback(() => {
    const targetIds =
      selectedLayerIds.length > 0
        ? selectedLayerIds
        : selectedLayerId
          ? [selectedLayerId]
          : [];
    const layersToNest = timelineLayers.filter(
      (layer) => targetIds.includes(layer.id) && !isPrecompLayer(layer)
    );
    if (layersToNest.length === 0 || !activeCompositionId) {
      showStatus("Select one or more layers to pre-compose");
      return;
    }

    const activeComp = projectItems.find(
      (item) => item.id === activeCompositionId && item.type === "composition"
    );
    const compMeta = activeComp?.composition;
    if (!compMeta) {
      return;
    }

    const minStart = Math.min(...layersToNest.map((layer) => layer.startTime));
    const maxEnd = Math.max(...layersToNest.map((layer) => layerCompEnd(layer)));
    const nestedDuration = Math.max(0.1, maxEnd - minStart);

    const precompName = nextCompositionName(projectItems);
    const nestedCompItem: ProjectItem = {
      ...createCompositionItem(undefined, precompName),
      composition: {
        width: compMeta.width,
        height: compMeta.height,
        fps: compMeta.fps,
        duration: nestedDuration,
      },
    };

    const nestedLayers = reindexLayers(
      layersToNest.map((layer) => ({
        ...layer,
        startTime: layer.startTime - minStart,
      }))
    );

    const nextStates = captureActiveCompRuntime({
      activeCompositionId,
      timelineLayers,
      compCurrentTime,
      workAreaStart,
      workAreaEnd,
      selectedLayerId,
      compStatesById,
    });
    const precompLayer = createPrecompLayer(
      nestedCompItem,
      timelineLayers.length - layersToNest.length + 1,
      compMeta.width,
      compMeta.height,
      minStart,
      nestedDuration
    );

    const remainingLayers = timelineLayers.filter(
      (layer) => !targetIds.includes(layer.id)
    );
    const nextLayers = reindexLayers([...remainingLayers, precompLayer]);
    const nextDuration = nextLayers.reduce(
      (max, layer) => Math.max(max, layerCompEnd(layer)),
      compMeta.duration
    );

    nextStates[nestedCompItem.id] = {
      layers: nestedLayers,
      currentTime: 0,
      workAreaStart: 0,
      workAreaEnd: nestedDuration,
      selectedLayerId: nestedLayers[0]?.id ?? null,
    };
    nextStates[activeCompositionId] = {
      layers: nextLayers,
      currentTime: compCurrentTime,
      workAreaStart,
      workAreaEnd: Math.max(workAreaEnd, nextDuration),
      selectedLayerId: precompLayer.id,
    };

    const nextItems = [
      ...projectItems.map((item) =>
        item.id === activeCompositionId && item.type === "composition" && item.composition
          ? {
              ...item,
              composition: {
                ...item.composition,
                duration: Math.max(item.composition.duration, nextDuration),
              },
            }
          : item
      ),
      nestedCompItem,
    ];

    setProjectItems(nextItems);
    setCompStatesById(nextStates);
    setTimelineLayers(nextLayers);
    setSelectedLayerId(precompLayer.id);
    setSelectedLayerIds([precompLayer.id]);
    setWorkAreaEnd((prev) => Math.max(prev, nextDuration));
    recordHistory({
      projectItems: nextItems,
      timelineLayers: nextLayers,
      compStatesById: nextStates,
      selectedLayerId: precompLayer.id,
    });
    showStatus(`Pre-composed ${layersToNest.length} layer(s) → ${nestedCompItem.name}`);
  }, [
    activeCompositionId,
    compCurrentTime,
    compStatesById,
    projectItems,
    recordHistory,
    selectedLayerId,
    selectedLayerIds,
    showStatus,
    timelineLayers,
    workAreaEnd,
    workAreaStart,
  ]);

  const compositionRenderInput = useMemo(() => {
    const referencePath =
      selectedInputPath ??
      timelineLayers.find((layer) => layer.sourcePath)?.sourcePath ??
      projectDoc.projectPath ??
      "composition_render.mp4";
    return {
      composition: {
        name: activeComposition?.name ?? "Composition",
        width: compWidth,
        height: compHeight,
        fps,
        duration: compositionDuration,
        workAreaStart,
        workAreaEnd,
      },
      layers: timelineLayers,
      mediaInfoByPath: Object.fromEntries(
        Object.entries(mediaMap).map(([path, entry]) => [path, entry.mediaInfo ?? {}])
      ),
      selectedLayerId,
      renderRange,
      outputPath: buildCompositionOutputPath(
        activeComposition?.name ?? "Composition",
        referencePath
      ),
      exportCrf: exportSettings.exportCrf,
      exportPreset: exportSettings.exportPreset,
      exportAudioBitrate: exportSettings.exportAudioBitrate,
    };
  }, [
    selectedInputPath,
    timelineLayers,
    projectDoc.projectPath,
    activeComposition?.name,
    compWidth,
    compHeight,
    fps,
    compositionDuration,
    workAreaStart,
    workAreaEnd,
    exportSettings,
    mediaMap,
    selectedLayerId,
    renderRange,
  ]);

  const resolvedRenderRange = useMemo(
    () =>
      resolveRenderRange(
        renderRange,
        {
          duration: compositionDuration,
          workAreaStart,
          workAreaEnd,
        },
        selectedLayer
      ),
    [renderRange, compositionDuration, workAreaStart, workAreaEnd, selectedLayer]
  );

  useEffect(() => {
    async function updatePreview() {
      if (timelineLayers.length === 0 || compositionDuration <= 0) {
        setCommandPreview("");
        setCommandPreviewNote("");
        return;
      }

      const built = buildCompositionRenderArgs(compositionRenderInput);
      const resolved = ffmpegStatus ?? (await refreshFfmpegStatus());
      let preview = `ffmpeg ${built.args.join(" ")}`;
      if (resolved.ok && resolved.ffmpegPath) {
        preview = await window.ffmpegStudio.getCommandPreview(
          resolved.ffmpegPath,
          built.args
        );

        const vidstabLayer = timelineLayers.find((layer) =>
          (layer.effects ?? []).some(
            (effect) => effect.enabled && effect.type === "vidstab"
          )
        );
        const vidstabEffect = vidstabLayer?.effects?.find(
          (effect) => effect.enabled && effect.type === "vidstab"
        );
        if (vidstabLayer?.sourcePath && vidstabEffect && resolved.ffmpegPath) {
          const { buildVidstabTwoPassPreview } = await import(
            "../ffmpeg/effectCommandPreview"
          );
          const twoPass = await buildVidstabTwoPassPreview(
            resolved.ffmpegPath,
            vidstabLayer.sourcePath,
            compositionRenderInput.outputPath,
            vidstabEffect
          );
          preview = `${preview}\n\n--- VidStab two-pass ---\n${twoPass}`;
        }
      }

      const notes: string[] = [
        `Render Composition: ${compositionRenderInput.composition.name}`,
        "Render mode: Multi-layer composition",
        `Video layers: ${built.videoLayerCount}`,
        `Audio layers: ${built.audioLayerCount}`,
        formatRenderRangeLabel(built.range),
        `Duration: ${built.renderDuration.toFixed(3)}s`,
      ];
      if (built.renderLayers.length > 0) {
        notes.push(
          `Layers: ${built.renderLayers.map((layer) => layer.name).join(", ")}`
        );
      }
      if (built.renderCompat.summaryLines.length > 0) {
        notes.push(...built.renderCompat.summaryLines);
      }
      if (built.warnings.length > 0) {
        notes.push("Warnings:", ...built.warnings.map((warning) => `- ${warning}`));
      }
      const precompWarnings = collectPrecompRenderWarnings(
        timelineLayers,
        getLayersForComposition
      );
      if (precompWarnings.length > 0) {
        notes.push(...precompWarnings.map((warning) => `- ${warning}`));
      }
      const precompLayerCount = timelineLayers.filter(
        (layer) => layer.enabled && isPrecompLayer(layer)
      ).length;
      if (precompLayerCount > 0) {
        notes.push(
          `Precomp layers: ${precompLayerCount} (nested render → intermediate MP4 before parent export)`
        );
      }

      setCommandPreview(preview);
      setCommandPreviewNote(notes.join("\n"));
    }

    updatePreview();
  }, [
    timelineLayers.length,
    compositionDuration,
    compositionRenderInput,
    ffmpegStatus,
    getLayersForComposition,
    refreshFfmpegStatus,
    timelineLayers,
  ]);

  const probeFile = async (inputPath: string): Promise<MediaInfo | undefined> => {
    try {
      const mediaInfo = await window.ffmpegStudio.probeFile(inputPath);
      setMediaMap((prev) => ({
        ...prev,
        [inputPath]: { mediaInfo },
      }));
      if (mediaInfo.width && mediaInfo.height) {
        setVideoSize({ width: mediaInfo.width, height: mediaInfo.height });
      }
      return mediaInfo;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMediaMap((prev) => ({
        ...prev,
        [inputPath]: { probeError: message },
      }));
      return undefined;
    }
  };

  const updateProjectItem = useCallback(
    (itemId: string, patch: Partial<ProjectItem>) => {
      setProjectItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const proxyGeneratingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const job of jobs) {
      if (
        job.jobKind === "proxy" &&
        (job.status === "running" || job.status === "pending") &&
        job.relatedProjectItemId
      ) {
        ids.add(job.relatedProjectItemId);
      }
    }
    return ids;
  }, [jobs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const item of projectItems) {
        if (item.type !== "footage" || item.compatibilityStatus !== "proxy-generating") {
          continue;
        }
        if (proxyGeneratingIds.has(item.id)) {
          continue;
        }

        const proxyJob = findProxyJobForItem(jobs, item.id);
        if (proxyJob?.status === "error") {
          updateProjectItem(item.id, {
            compatibilityStatus: "proxy-failed",
            compatibilityReason: proxyJob.error ?? "Proxy failed.",
          });
          continue;
        }
        if (proxyJob?.status === "cancelled") {
          updateProjectItem(item.id, {
            compatibilityStatus: "proxy-failed",
            compatibilityReason: "Proxy creation was cancelled.",
          });
          continue;
        }
        if (proxyJob?.status === "done" && !item.proxyPath) {
          // handleBackgroundJobDone applies paths asynchronously after verification.
          continue;
        }
        if (!proxyJob) {
          const startedAt = item.lastPreviewCheckAt
            ? Date.parse(item.lastPreviewCheckAt)
            : 0;
          if (startedAt && Date.now() - startedAt < 15_000) {
            continue;
          }
          updateProjectItem(item.id, {
            compatibilityStatus: "proxy-failed",
            compatibilityReason: "Proxy job did not start.",
          });
        }
      }
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [jobs, projectItems, proxyGeneratingIds, updateProjectItem]);

  const cachePreviewBusy = useMemo(
    () =>
      jobs.some(
        (job) =>
          job.jobKind === "preview-cache" &&
          (job.status === "running" || job.status === "pending")
      ),
    [jobs]
  );

  const handleBackgroundJobDone = useCallback(
    async (job: Job) => {
      if (job.jobKind === "proxy" && job.relatedProjectItemId) {
        const itemId = job.relatedProjectItemId;
        const item = projectItems.find((entry) => entry.id === itemId);
        if (!item || item.type !== "footage" || !item.path) {
          return;
        }
        const proxyPath = job.outputPath;
        const stats = await window.ffmpegStudio.getMediaFileStats([proxyPath]);
        const fileStats = stats[proxyPath];
        if (!fileStats?.exists || fileStats.sizeBytes <= 0) {
          console.error("[PROXY_ERROR] output verification failed", {
            proxyPath,
            fileStats,
          });
          updateProjectItem(itemId, {
            compatibilityStatus: "proxy-failed",
            compatibilityReason: "Preview proxy file is missing or empty.",
          });
          showStatus(`Proxy failed for ${item.name}: output file invalid`);
          return;
        }
        console.log("[PROXY_DONE]", {
          outputPath: proxyPath,
          exists: fileStats.exists,
          sizeBytes: fileStats.sizeBytes,
        });
        updateProjectItem(itemId, {
          proxyPath,
          previewPath: proxyPath,
          compatibilityStatus: "proxy-ready",
          compatibilityReason: undefined,
        });
        console.log("[PROXY_APPLY]", {
          projectItemId: itemId,
          proxyPath,
          previewPath: proxyPath,
          compatibilityStatus: "proxy-ready",
        });
        clearNativePreviewCacheForPath(item.path);
        setPreviewErrorsByPath((prev) => {
          const next = { ...prev };
          delete next[item.path!];
          return next;
        });
        mediaVisualCache.invalidatePath(item.path);
        mediaVisualCache.invalidatePath(proxyPath);
        showStatus(`Proxy ready: ${item.name}`);
        return;
      }

      if (job.jobKind === "preview-cache") {
        setPreviewCache({
          cacheId: activeCompositionId ?? "composition",
          path: job.outputPath,
          startTime: previewCache.startTime,
          endTime: previewCache.endTime,
          status: "valid",
          fingerprint: computePreviewCacheFingerprint(
            timelineLayers,
            compWidth,
            compHeight,
            fps
          ),
        });
        setUseCachedPreview(true);
        showStatus("Preview cached — playback will use cache");
        return;
      }

      if (
        job.jobKind === "analysis" &&
        job.relatedLayerId &&
        job.relatedEffectId
      ) {
        setTimelineLayers((prev) =>
          prev.map((layer) => {
            if (layer.id !== job.relatedLayerId) {
              return layer;
            }
            return {
              ...layer,
              effects: (layer.effects ?? []).map((effect) =>
                effect.id === job.relatedEffectId
                  ? {
                      ...effect,
                      params: {
                        ...effect.params,
                        analysisStatus: "ready",
                        analysisPath: job.outputPath,
                      },
                    }
                  : effect
              ),
            };
          })
        );
        showStatus("Stabilization analysis ready");
        return;
      }

      if (job.jobKind === "render") {
        const cleanupPaths = precompCleanupByParentJobRef.current[job.id];
        if (cleanupPaths?.length) {
          void window.ffmpegStudio.deleteMediaPaths(cleanupPaths);
          delete precompCleanupByParentJobRef.current[job.id];
        }
        showStatus(`Render complete: ${getBasename(job.outputPath)}`);
      }
    },
    [
      activeCompositionId,
      compHeight,
      compWidth,
      fps,
      mediaVisualCache,
      previewCache.endTime,
      previewCache.startTime,
      projectItems,
      showStatus,
      timelineLayers,
      updateProjectItem,
    ]
  );

  const handleBackgroundJobError = useCallback(
    (job: Job) => {
      if (job.jobKind === "proxy" && job.relatedProjectItemId) {
        console.error("[PROXY_ERROR]", {
          projectItemId: job.relatedProjectItemId,
          error: job.error,
          outputPath: job.outputPath,
        });
        updateProjectItem(job.relatedProjectItemId, {
          compatibilityStatus: "proxy-failed",
          compatibilityReason: job.error ?? "Could not create proxy.",
        });
        showStatus(job.error ?? "Proxy failed. Retry from preview.");
        return;
      }

      if (job.jobKind === "preview-cache") {
        setPreviewCache((prev) => ({
          ...prev,
          status: "failed",
          error: job.error ?? "Preview cache failed",
        }));
        showStatus(job.error ?? "Preview cache failed");
        return;
      }

      if (
        job.jobKind === "analysis" &&
        job.relatedLayerId &&
        job.relatedEffectId
      ) {
        setTimelineLayers((prev) =>
          prev.map((layer) => {
            if (layer.id !== job.relatedLayerId) {
              return layer;
            }
            return {
              ...layer,
              effects: (layer.effects ?? []).map((effect) =>
                effect.id === job.relatedEffectId
                  ? {
                      ...effect,
                      params: {
                        ...effect.params,
                        analysisStatus: "error",
                      },
                    }
                  : effect
              ),
            };
          })
        );
        showStatus(job.error ?? "Stabilization analysis failed");
        return;
      }

      if (job.jobKind === "render") {
        const cleanupPaths = precompCleanupByParentJobRef.current[job.id];
        if (cleanupPaths?.length) {
          void window.ffmpegStudio.deleteMediaPaths(cleanupPaths);
          delete precompCleanupByParentJobRef.current[job.id];
        }
        showStatus(job.error ?? "Render failed. See logs.");
      }
    },
    [showStatus, updateProjectItem]
  );

  const { enqueueBackgroundJobs, cancelBackgroundJob } = useBackgroundJobQueue({
    jobs,
    setJobs,
    setIsRunning,
    setSelectedJobId,
    setBottomTab,
    ffmpegStatus,
    refreshFfmpegStatus,
    onJobDone: handleBackgroundJobDone,
    onJobError: handleBackgroundJobError,
  });

  const selectedFootageItems = useMemo(
    () =>
      projectItems.filter(
        (item) =>
          selectedProjectItemIds.includes(item.id) &&
          item.type === "footage" &&
          !item.missing &&
          item.path
      ),
    [projectItems, selectedProjectItemIds]
  );

  const handleCreatePreviewProxy = useCallback(
    async (itemId: string) => {
      const item = projectItems.find((entry) => entry.id === itemId);
      if (!item || item.type !== "footage" || !item.path) {
        return;
      }

      if (proxyGeneratingIds.has(itemId)) {
        return;
      }

      updateProjectItem(itemId, {
        compatibilityStatus: "proxy-generating",
        compatibilityReason: undefined,
        lastPreviewCheckAt: new Date().toISOString(),
      });

      const proxyPath = await window.ffmpegStudio.resolvePreviewProxyPath(itemId);
      const args = buildPreviewProxyArgs(item.path, proxyPath);
      console.log("[PROXY_START]", {
        projectItemId: itemId,
        inputPath: item.path,
        outputPath: proxyPath,
        args,
      });
      const job = createProxyJob({
        inputPath: item.path,
        outputPath: proxyPath,
        args,
        projectItemId: itemId,
        durationSeconds: item.mediaInfo?.durationSeconds,
      });
      job.log = [
        `[PROXY_START] input=${item.path} output=${proxyPath}`,
        `args: ${args.join(" ")}`,
      ];
      try {
        await enqueueBackgroundJobs([job]);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not start proxy job.";
        updateProjectItem(itemId, {
          compatibilityStatus: "proxy-failed",
          compatibilityReason: message,
        });
        showStatus(`Proxy failed for ${item.name}: ${message}`);
      }
    },
    [enqueueBackgroundJobs, projectItems, proxyGeneratingIds, showStatus, updateProjectItem]
  );

  const handleBatchCreateProxies = useCallback(async () => {
    if (selectedFootageItems.length === 0) {
      showStatus("Select footage items first");
      return;
    }
    for (const item of selectedFootageItems) {
      await handleCreatePreviewProxy(item.id);
    }
    setBottomTab("tasks");
    showStatus(`Created ${selectedFootageItems.length} proxy job(s)`);
  }, [handleCreatePreviewProxy, selectedFootageItems, showStatus]);

  const finalizeImportedFootage = useCallback(
    async (item: ProjectItem) => {
      if (item.type !== "footage" || !item.path) {
        return;
      }

      if (PREVIEW_ENGINE_ENABLED) {
        updateProjectItem(item.id, engineImportPreviewPatch(item));
        showStatus(`Preview ready (engine): ${item.name}`);
        return;
      }

      const settings = await window.ffmpegStudio.getSettings();

      updateProjectItem(item.id, { compatibilityStatus: "checking-preview" });
      showStatus(`Checking Chromium preview for ${item.name}…`);

      const previewResult = await runNativePreviewCheck(
        { ...item, compatibilityStatus: "checking-preview" },
        { previewBackend: settings.previewBackend }
      );

      if (!previewResult.ok) {
        const reason =
          previewResult.error ?? "Native Electron video preview failed";
        markNativePreviewFailed(item.path, reason);
        updateProjectItem(item.id, chromiumFailImportPatch(item, reason));
        setPreviewErrorsByPath((prev) => ({
          ...prev,
          [item.path!]: reason,
        }));
        showStatus(`Chromium preview unavailable for ${item.name}`);
        return;
      }

      updateProjectItem(item.id, chromiumOkImportPatch(item));
      showStatus(`Preview ready: ${item.name}`);
    },
    [showStatus, updateProjectItem]
  );

  const handleRetryChromiumPreview = useCallback(
    async (itemId: string) => {
      const item = projectItems.find((entry) => entry.id === itemId);
      if (!item || item.type !== "footage" || !canRetryChromiumPreview(item)) {
        return;
      }

      if (PREVIEW_ENGINE_ENABLED) {
        showStatus("Chromium preview retry is disabled while preview engine is active");
        return;
      }

      const path = item.path!;
      clearNativePreviewCacheForPath(path);
      setPreviewErrorsByPath((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });

      const retryItem: ProjectItem = {
        ...item,
        ...resetChromiumPreviewForRetry(item),
      };
      updateProjectItem(item.id, resetChromiumPreviewForRetry(item));
      showStatus(`Retrying Chromium preview for ${item.name}…`);
      await finalizeImportedFootage(retryItem);
    },
    [finalizeImportedFootage, projectItems, showStatus, updateProjectItem]
  );

  const generateFootageThumbnail = useCallback(
    async (item: ProjectItem) => {
      if (item.type !== "footage" || !item.path || item.missing) {
        return;
      }
      if (extractThumbnailDataUrl(item.thumbnailDataUrl)) {
        return;
      }
      if (thumbnailInFlightIds.current.has(item.id)) {
        return;
      }

      const inputPath = item.originalPath ?? item.path;
      thumbnailInFlightIds.current.add(item.id);
      try {
        const dataUrl = await fetchProjectItemThumbnailDataUrl(inputPath);
        if (dataUrl) {
          updateProjectItem(item.id, {
            thumbnailDataUrl: dataUrl,
            thumbnailStatus: "ready",
          });
        } else {
          updateProjectItem(item.id, { thumbnailStatus: "failed" });
        }
      } finally {
        thumbnailInFlightIds.current.delete(item.id);
      }
    },
    [updateProjectItem]
  );

  const handleBatchAddToQueue = useCallback(async () => {
    if (selectedFootageItems.length === 0) {
      showStatus("Select footage items first");
      return;
    }

    const jobsToEnqueue: Job[] = [];
    for (const item of selectedFootageItems) {
      const candidate = buildBatchOutputPath(
        item.path!,
        "batch-passthrough",
        "processed"
      );
      const outputPath = await resolveUniqueOutputPath(
        candidate,
        window.ffmpegStudio.checkMediaPaths
      );
      const { job, error } = createBatchPassthroughRenderJobForItem(
        item,
        exportSettings,
        outputPath
      );
      if (job) {
        jobsToEnqueue.push(job);
      } else if (error) {
        showStatus(error);
      }
    }

    if (jobsToEnqueue.length > 0) {
      await enqueueBackgroundJobs(jobsToEnqueue);
      setBottomTab("tasks");
      showStatus(`Created ${jobsToEnqueue.length} batch job(s)`);
    }
  }, [enqueueBackgroundJobs, exportSettings, selectedFootageItems, showStatus]);

  const handleBatchApplyConfirm = useCallback(
    async (options: BatchApplyOptions) => {
      setBatchApplyDialogOpen(false);
      if (selectedFootageItems.length === 0) {
        return;
      }

      const recipe = getFilterRecipeById(options.recipeId);
      if (!recipe) {
        showStatus("Unknown preset");
        return;
      }

      const availability = { hasFilter: (name: string) => availableNames.has(name) };
      const blockReason = getBatchRecipeBlockReason(options.recipeId, availability);
      if (blockReason) {
        showStatus(blockReason);
        return;
      }

      const outputDir =
        options.outputMode === "custom-folder" ? options.outputFolder : null;
      const paramOverrides =
        options.recipeId === "quick-deshake" && options.deshakeStrength
          ? { strength: options.deshakeStrength }
          : undefined;

      const jobsToEnqueue: Job[] = [];
      for (const item of selectedFootageItems) {
        const candidate = buildBatchOutputPath(
          item.path!,
          options.recipeId,
          options.filenameTemplate,
          outputDir
        );
        const outputPath = await resolveUniqueOutputPath(
          candidate,
          window.ffmpegStudio.checkMediaPaths
        );
        const { job, error } = createBatchRenderJobForItem(
          item,
          recipe,
          exportSettings,
          outputPath,
          availability,
          paramOverrides
        );
        if (job) {
          jobsToEnqueue.push(job);
        } else if (error) {
          showStatus(`${item.name}: ${error}`);
        }
      }

      if (jobsToEnqueue.length > 0) {
        await enqueueBackgroundJobs(jobsToEnqueue);
        setBottomTab("tasks");
        showStatus(`Created ${jobsToEnqueue.length} batch job(s)`);
      }
    },
    [
      availableNames,
      enqueueBackgroundJobs,
      exportSettings,
      selectedFootageItems,
      showStatus,
    ]
  );

  const handlePreviewError = useCallback(
    (sourcePath: string, message: string) => {
      const fromNodeAv = message.startsWith("node-av: ");
      const displayMessage = fromNodeAv ? message.slice("node-av: ".length) : message;

      if (fromNodeAv) {
        setPreviewErrorsByPath((prev) => {
          if (prev[sourcePath] === displayMessage) {
            return prev;
          }
          return { ...prev, [sourcePath]: displayMessage };
        });
        const matchingItem = projectItems.find(
          (item) =>
            item.type === "footage" &&
            (item.path ?? item.originalPath) === sourcePath
        );
        if (matchingItem) {
          showStatus(`FFmpeg preview failed for ${matchingItem.name}: ${displayMessage}`);
        } else {
          showStatus(`FFmpeg preview failed: ${displayMessage}`);
        }
        return;
      }

      markNativePreviewFailed(sourcePath, displayMessage);
      setPreviewErrorsByPath((prev) => {
        if (prev[sourcePath] === displayMessage) {
          return prev;
        }
        return { ...prev, [sourcePath]: displayMessage };
      });

      const matchingItem = projectItems.find(
        (item) =>
          item.type === "footage" &&
          (item.path ?? item.originalPath) === sourcePath
      );
      if (!matchingItem) {
        showStatus(`Preview failed for ${sourcePath}`);
        return;
      }
      if (
        matchingItem.compatibilityStatus === "proxy-ready" ||
        matchingItem.compatibilityStatus === "proxy-generating" ||
        matchingItem.compatibilityStatus === "proxy-failed"
      ) {
        return;
      }

      if (matchingItem.compatibilityStatus === "native-preview-failed") {
        return;
      }

      updateProjectItem(matchingItem.id, {
        ...applyChromiumQuarantine(matchingItem),
        compatibilityReason: displayMessage,
        chromiumPreviewVerified: false,
        previewAttempted: true,
        lastPreviewCheckAt: new Date().toISOString(),
      });

      showStatus(`Chromium preview blocked for ${matchingItem.name}`);
    },
    [projectItems, showStatus, updateProjectItem]
  );

  const playbackDiagnosticsRef = useRef(playbackDiagnostics);
  const handlePlaybackDiagnostics = useCallback((diagnostics: PlaybackDiagnostics) => {
    const prev = playbackDiagnosticsRef.current;
    const videoTimeClose =
      prev.videoCurrentTime === diagnostics.videoCurrentTime ||
      (prev.videoCurrentTime !== null &&
        diagnostics.videoCurrentTime !== null &&
        Math.abs(prev.videoCurrentTime - diagnostics.videoCurrentTime) < 0.05);
    const driftClose =
      prev.driftSeconds === diagnostics.driftSeconds ||
      (prev.driftSeconds !== null &&
        diagnostics.driftSeconds !== null &&
        Math.abs(prev.driftSeconds - diagnostics.driftSeconds) < 0.02);

    if (
      prev.syncMode === diagnostics.syncMode &&
      prev.isPlaying === diagnostics.isPlaying &&
      prev.useCachePlayback === diagnostics.useCachePlayback &&
      prev.masterLayerId === diagnostics.masterLayerId &&
      prev.audibleLayerId === diagnostics.audibleLayerId &&
      prev.playbackRate === diagnostics.playbackRate &&
      Math.abs(prev.compCurrentTime - diagnostics.compCurrentTime) < 0.05 &&
      videoTimeClose &&
      driftClose
    ) {
      return;
    }

    playbackDiagnosticsRef.current = diagnostics;
    setPlaybackDiagnostics(diagnostics);
  }, []);

  const applyFlatEditorState = useCallback(
    async (flat: FlatEditorState) => {
      let items = await validateMediaItems(flat.projectItems);
      items = await probeLoadedMedia(items, probeFile);
      items = await attachThumbnailsToItems(items);
      const dims = mediaDimensionsFromItems(items);
      const comp = items.find(
        (item) => item.type === "composition" && item.id === flat.activeCompositionId
      );
      items = items.map((item) =>
        item.type === "composition"
          ? { ...item, name: migrateCompositionName(item.name) }
          : item
      );
      const rebuilt = rebuildEditorFromFlat(
        { ...flat, projectItems: items },
        comp?.composition?.width ?? 1280,
        comp?.composition?.height ?? 720,
        dims
      );
      let layers = rebuilt.timelineLayers;
      const trfPaths = layers.flatMap((layer) =>
        (layer.effects ?? [])
          .filter((effect) => effect.type === "vidstab")
          .map((effect) => String(effect.params.analysisPath ?? ""))
          .filter(Boolean)
      );
      if (trfPaths.length > 0) {
        const { markMissingVidstabAnalysis } = await import("../shared/project");
        const existsMap = await window.ffmpegStudio.checkMediaPaths(trfPaths);
        layers = markMissingVidstabAnalysis(layers, existsMap);
      }

      setProjectItems(rebuilt.projectItems);
      setTimelineLayers(layers);
      setJobs(rebuilt.jobs);
      setCompStatesById(flat.compStatesById ?? {});
      setCompNavStack([]);
      setActiveCompositionId(flat.activeCompositionId);
      setSelectedLayerId(flat.selectedLayerId);
      setSelectedProjectItemId(flat.selectedProjectItemId);
      setSelectedProjectItemIds(
        flat.selectedProjectItemId ? [flat.selectedProjectItemId] : []
      );
      setCompCurrentTime(flat.compCurrentTime);
      setExportSettings(flat.exportSettings);
      setWorkAreaStart(flat.workAreaStart);
      setWorkAreaEnd(flat.workAreaEnd);
      setRenderRange(flat.exportSettings.renderRange ?? "full");
      setImportError(null);
      setLogLines([]);
      setCommandPreview("");
      setCommandPreviewNote("");
    },
    []
  );

  const importMediaFiles = useCallback(
    async (rawPaths: string[], source: ImportSource) => {
      const paths = filterVideoPaths(rawPaths);

      if (rawPaths.length > 0 && paths.length === 0) {
        setImportError("No supported video files found.");
        return;
      }

      if (paths.length === 0) {
        setImportError("Could not read dropped file path. Try Add Media.");
        return;
      }

      setImportError(null);

      const hasComposition = projectItems.some((item) => item.type === "composition");
      const shouldOfferCompFromFootage =
        !hasComposition &&
        paths.length === 1 &&
        (source === "project-drop" || source === "window-drop");

      if (shouldOfferCompFromFootage) {
        const inputPath = paths[0];
        const existingFootage = projectItems.find(
          (item) => item.type === "footage" && item.path === inputPath
        );
        if (existingFootage) {
          setCreateCompFromFootageTarget(existingFootage);
          return;
        }

        showStatus(`Importing ${getBasename(inputPath)}…`);
        const mediaInfo = await probeFile(inputPath);
        const footageId = createProjectId("footage");
        const footageItem = createFootageProjectItem({
          id: footageId,
          path: inputPath,
          name: getBasename(inputPath),
          mediaInfo: mediaInfo ?? undefined,
          probeError: mediaInfo ? undefined : "FFprobe could not read file metadata",
        });
        const nextProjectItems = [...projectItems, footageItem];
        setProjectItems(nextProjectItems);
        recordHistory({ projectItems: nextProjectItems });
        setCreateCompFromFootageTarget(footageItem);
        showStatus(`Imported: ${footageItem.name}`);
        void finalizeImportedFootage(footageItem);
        if (!window.ffmpegStudio.previewSelftestEnabled) {
          void generateFootageThumbnail(footageItem);
        }
        return;
      }

      showStatus(`Importing ${paths.length} file${paths.length === 1 ? "" : "s"}…`);

      let nextProjectItems = [...projectItems];
      let nextLayers = [...timelineLayers];
      let nextJobs = [...jobs];
      let nextActiveCompId = activeCompositionId;
      let firstFootageId: string | null = null;
      let firstLayerId: string | null = null;
      let firstJobId: string | null = null;
      const importedFootage: ProjectItem[] = [];

      for (const inputPath of paths) {
        const existingFootage = nextProjectItems.find(
          (item) => item.type === "footage" && item.path === inputPath
        );

        if (existingFootage) {
          if (!firstFootageId) {
            firstFootageId = existingFootage.id;
          }
          const existingLayer = nextLayers.find((layer) => layer.sourcePath === inputPath);
          if (existingLayer && !firstLayerId) {
            firstLayerId = existingLayer.id;
          }
          const existingJob = nextJobs.find(
            (job) => job.inputPath === inputPath && job.status !== "done"
          );
          if (existingJob && !firstJobId) {
            firstJobId = existingJob.id;
          }
          continue;
        }

        showStatus(`Probing media: ${getBasename(inputPath)}…`);
        const mediaInfo = await probeFile(inputPath);
        const duration = mediaInfo?.durationSeconds ?? 10;

        const footageId = createProjectId("footage");
        const footageItem = createFootageProjectItem({
          id: footageId,
          path: inputPath,
          name: getBasename(inputPath),
          mediaInfo: mediaInfo ?? undefined,
          probeError: mediaInfo ? undefined : "FFprobe could not read file metadata",
        });
        nextProjectItems.push(footageItem);
        importedFootage.push(footageItem);

        let composition =
          (nextActiveCompId
            ? nextProjectItems.find(
                (item) => item.id === nextActiveCompId && item.type === "composition"
              )
            : undefined) ?? nextProjectItems.find((item) => item.type === "composition");
        if (!composition) {
          composition = createCompositionItem(mediaInfo);
          nextProjectItems.push(composition);
          nextActiveCompId = composition.id;
        }

        const lastLayerEnd = nextLayers.reduce(
          (max, layer) => Math.max(max, layerCompEnd(layer)),
          0
        );

        const startTime =
          source === "timeline-drop" && nextLayers.length > 0 ? lastLayerEnd : lastLayerEnd;

        const compW = composition?.composition?.width ?? 1280;
        const compH = composition?.composition?.height ?? 720;

        const layer = createTimelineLayer(
          footageId,
          inputPath,
          getBasename(inputPath),
          duration,
          nextLayers.length + 1,
          compW,
          compH,
          startTime
        );
        if (mediaInfo?.width && mediaInfo?.height) {
          layer.crop = createDefaultCrop(mediaInfo.width, mediaInfo.height);
        }

        nextLayers.push(layer);

        nextProjectItems = nextProjectItems.map((item) =>
          item.type === "composition" && item.id === composition?.id
            ? updateCompositionDuration(item, layerCompEnd(layer))
            : item
        );

        const job = createEditClipJob(
          inputPath,
          layerToEditOptionsFromLayer(
            layer,
            { width: compW, height: compH },
            {
              width: mediaInfo?.width ?? 0,
              height: mediaInfo?.height ?? 0,
            },
            exportSettings
          ),
          undefined,
          duration
        );
        if (mediaInfo) {
          job.durationSeconds = mediaInfo.durationSeconds;
        }
        nextJobs.push(job);

        if (!firstFootageId) {
          firstFootageId = footageId;
        }
        if (!firstLayerId) {
          firstLayerId = layer.id;
        }
        if (!firstJobId) {
          firstJobId = job.id;
        }
      }

      setProjectItems(nextProjectItems);
      setTimelineLayers(nextLayers);
      setJobs(nextJobs);

      if (nextActiveCompId) {
        setActiveCompositionId(nextActiveCompId);
      }
      if (firstFootageId) {
        setSelectedProjectItemId(firstFootageId);
        setSelectedProjectItemIds([firstFootageId]);
      }
      if (firstLayerId) {
        setSelectedLayerId(firstLayerId);
      }
      if (firstJobId) {
        setSelectedJobId(firstJobId);
      }

      const nextCompDuration = nextLayers.reduce(
        (max, layer) => Math.max(max, layerCompEnd(layer)),
        0
      );
      if (nextCompDuration > 0) {
        setWorkAreaEnd((prev) => (prev > 0 ? prev : nextCompDuration));
      }

      const importedCompStates = captureActiveCompRuntime({
        activeCompositionId,
        timelineLayers,
        compCurrentTime,
        workAreaStart,
        workAreaEnd,
        selectedLayerId,
        compStatesById,
      });
      if (nextActiveCompId) {
        importedCompStates[nextActiveCompId] = {
          layers: nextLayers,
          currentTime: 0,
          workAreaStart: 0,
          workAreaEnd: nextCompDuration > 0 ? nextCompDuration : workAreaEnd,
          selectedLayerId: firstLayerId,
        };
      }
      setCompStatesById(importedCompStates);
      recordHistory({
        projectItems: nextProjectItems,
        timelineLayers: nextLayers,
        activeCompositionId: nextActiveCompId,
        selectedLayerId: firstLayerId,
        selectedProjectItemId: firstFootageId,
        workAreaEnd: nextCompDuration > 0 ? nextCompDuration : workAreaEnd,
        compStatesById: importedCompStates,
      });

      if (importedFootage.length > 0) {
        const names = importedFootage.map((item) => item.name).join(", ");
        showStatus(`Imported: ${names}`);
        for (const item of importedFootage) {
          void finalizeImportedFootage(item);
          if (!window.ffmpegStudio.previewSelftestEnabled) {
            void generateFootageThumbnail(item);
          }
        }
      }
    },
    [
      exportSettings,
      projectItems,
      timelineLayers,
      jobs,
      activeCompositionId,
      recordHistory,
      workAreaEnd,
      showStatus,
      compCurrentTime,
      compStatesById,
      finalizeImportedFootage,
      generateFootageThumbnail,
      selectedLayerId,
      workAreaStart,
    ]
  );

  const handleAddMedia = async () => {
    const paths = await window.ffmpegStudio.openFileDialog();
    if (paths.length > 0) {
      await importMediaFiles(paths, "dialog");
    }
  };

  const handleSelectProjectItem = (
    itemId: string,
    modifiers: ProjectItemSelectModifiers = {
      ctrlKey: false,
      shiftKey: false,
      visibleItemIds: projectItems.map((entry) => entry.id),
    }
  ) => {
    if (!modifiers.ctrlKey && !modifiers.shiftKey) {
      setSelectedProjectItemIds([itemId]);
    } else if (modifiers.ctrlKey) {
      setSelectedProjectItemIds((prev) =>
        prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
      );
    } else if (modifiers.shiftKey) {
      const anchor = selectedProjectItemId ?? itemId;
      const ids = modifiers.visibleItemIds;
      const anchorIndex = ids.indexOf(anchor);
      const clickIndex = ids.indexOf(itemId);
      if (anchorIndex >= 0 && clickIndex >= 0) {
        const [start, end] =
          anchorIndex < clickIndex ? [anchorIndex, clickIndex] : [clickIndex, anchorIndex];
        setSelectedProjectItemIds(ids.slice(start, end + 1));
      } else {
        setSelectedProjectItemIds([itemId]);
      }
    }

    setSelectedProjectItemId(itemId);
    const item = projectItems.find((entry) => entry.id === itemId);
    if (item?.type === "composition") {
      switchComposition(item.id);
      return;
    }

    if (item?.type === "footage" && item.path) {
      const layer = timelineLayers.find((entry) => entry.sourcePath === item.path);
      if (layer) {
        setSelectedLayerId(layer.id);
      }
      const job = jobs.find((entry) => entry.inputPath === item.path);
      if (job) {
        setSelectedJobId(job.id);
      }
    }
  };

  const handleSelectLayer = (layerId: string) => {
    setSelectedLayerId(layerId);
    const layer = timelineLayers.find((entry) => entry.id === layerId);
    if (!layer) {
      return;
    }
    const footage = projectItems.find(
      (item) => item.type === "footage" && item.path === layer.sourcePath
    );
    if (footage) {
      setSelectedProjectItemId(footage.id);
      setSelectedProjectItemIds([footage.id]);
    }
    const job = jobs.find((entry) => entry.inputPath === layer.sourcePath);
    if (job) {
      setSelectedJobId(job.id);
    }
  };

  const handleLayerChange = (layerId: string, patch: Partial<TimelineLayer>) => {
    setTimelineLayers((prev) => {
      const next = prev.map((layer) => {
        if (layer.id !== layerId) {
          return layer;
        }
        const merged: TimelineLayer = { ...layer, ...patch };
        if (patch.transform) {
          merged.transform = { ...layer.transform, ...patch.transform };
        }
        return merged;
      });
      const updated = next.find((layer) => layer.id === layerId);
      if (updated) {
        updateCompositionFromLayers(next);
      }
      if (!isDraggingHistoryRef.current) {
        queueMicrotask(() => recordHistory({ timelineLayers: next }));
      }
      return next;
    });
  };

  const handleCropChange = (crop: CropRect) => {
    if (!selectedLayerId) {
      return;
    }
    handleLayerChange(selectedLayerId, { crop });
  };

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      lastAppTimeNotifyMsRef.current = 0;
    }
  }, [isPlaying]);

  useEffect(() => {
    compCurrentTimeRef.current = compCurrentTime;
  }, [compCurrentTime]);

  const handleCompCurrentTimeChange = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(compositionDuration || time, time));
    const now = performance.now();
    const jumpedWhilePlaying =
      isPlayingRef.current && Math.abs(clamped - compCurrentTimeRef.current) >= 0.5;
    if (
      isPlayingRef.current &&
      !jumpedWhilePlaying &&
      now - lastAppTimeNotifyMsRef.current < PLAYBACK_TIME_NOTIFY_MS
    ) {
      return;
    }
    lastAppTimeNotifyMsRef.current = now;
    compCurrentTimeRef.current = clamped;
    setCompCurrentTime(clamped);
  }, [compositionDuration]);

  const handleSeek = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(compositionDuration || time, time));
    lastAppTimeNotifyMsRef.current = 0;
    compCurrentTimeRef.current = clamped;
    logAppSeek(clamped);
    videoPreviewRef.current?.armUserSeek?.(clamped);
    setSeekTime(clamped);
    setCompCurrentTime(clamped);
  }, [compositionDuration]);

  usePreviewE2eBootstrap({
    startupReady: startup.stage === "ready",
    importMediaFiles,
    getProjectItemsCount: () => projectItemsRef.current.length,
    getTimelineLayersCount: () => timelineLayersRef.current.length,
    getCurrentTime: () => compCurrentTimeRef.current,
    getIsPlaying: () => isPlayingRef.current,
  });

  const handleExportSettingsChange = (patch: Partial<ExportSettings>) => {
    const next = { ...exportSettings, ...patch, renderRange };
    setExportSettings(next);
    recordHistory({ exportSettings: next });
  };

  const handleTransformChange = useCallback(
    (patch: Partial<LayerTransform>) => {
      if (!selectedLayerId) {
        return;
      }
      setTimelineLayers((prev) => {
        const next = prev.map((layer) => {
          if (layer.id !== selectedLayerId) {
            return layer;
          }
          const result = applyTransformPatchWithKeyframes(
            layer,
            patch,
            compCurrentTime,
            layer.uniformScale
          );
          return { ...layer, ...result };
        });
        if (!isDraggingHistoryRef.current) {
          queueMicrotask(() => recordHistory({ timelineLayers: next }));
        }
        return next;
      });
    },
    [compCurrentTime, recordHistory, selectedLayerId]
  );

  const handleMoveKeyframe = useCallback(
    (
      layerId: string,
      property: TransformPropertyKey,
      keyframeId: string,
      newTime: number
    ) => {
      setTimelineLayers((prev) =>
        prev.map((layer) => {
          if (layer.id !== layerId) {
            return layer;
          }
          return {
            ...layer,
            keyframes: {
              ...layer.keyframes,
              [property]: moveKeyframeTime(
                layer.keyframes[property],
                keyframeId,
                newTime
              ),
            },
          };
        })
      );
    },
    []
  );

  const handleMoveEffectKeyframe = useCallback(
    (
      layerId: string,
      effectId: string,
      param: string,
      keyframeId: string,
      newTime: number
    ) => {
      setTimelineLayers((prev) =>
        prev.map((layer) => {
          if (layer.id !== layerId) {
            return layer;
          }
          return moveSelectedEffectKeyframe(layer, effectId, param, keyframeId, newTime);
        })
      );
    },
    []
  );

  const handleLayerTransformChange = useCallback(
    (layerId: string, patch: Partial<LayerTransform>) => {
      setTimelineLayers((prev) => {
        const next = prev.map((layer) => {
          if (layer.id !== layerId) {
            return layer;
          }
          const result = applyTransformPatchWithKeyframes(
            layer,
            patch,
            compCurrentTime,
            layer.uniformScale
          );
          return { ...layer, ...result };
        });
        if (!isDraggingHistoryRef.current) {
          queueMicrotask(() => recordHistory({ timelineLayers: next }));
        }
        return next;
      });
    },
    [compCurrentTime, recordHistory]
  );

  const handleLayerToggleTransformAnimation = useCallback(
    (layerId: string, group: TransformGroupKey) => {
      setTimelineLayers((prev) => {
        const next = prev.map((layer) => {
          if (layer.id !== layerId) {
            return layer;
          }
          return {
            ...layer,
            collapsed: false,
            transformExpanded: true,
            keyframes: toggleTransformGroupAnimation(
              layer.keyframes,
              group,
              layer,
              compCurrentTime
            ),
          };
        });
        recordHistory({ timelineLayers: next });
        return next;
      });
    },
    [compCurrentTime, recordHistory]
  );

  const handleLayerToggleKeyframeDiamond = useCallback(
    (layerId: string, group: TransformGroupKey) => {
      setTimelineLayers((prev) => {
        const next = prev.map((layer) => {
          if (layer.id !== layerId) {
            return layer;
          }
          return {
            ...layer,
            collapsed: false,
            transformExpanded: true,
            keyframes: toggleKeyframeDiamondAtTime(
              layer.keyframes,
              group,
              layer,
              compCurrentTime
            ),
          };
        });
        recordHistory({ timelineLayers: next });
        return next;
      });
    },
    [compCurrentTime, recordHistory]
  );

  const handleLayerToggleEffectParamAnimation = useCallback(
    (layerId: string, effectId: string, param: string) => {
      setTimelineLayers((prev) => {
        const next = prev.map((layer) => {
          if (layer.id !== layerId) {
            return layer;
          }
          return {
            ...layer,
            collapsed: false,
            effects: (layer.effects ?? []).map((effect) =>
              effect.id === effectId
                ? toggleEffectParamAnimation(effect, param, compCurrentTime)
                : effect
            ),
          };
        });
        recordHistory({ timelineLayers: next });
        return next;
      });
    },
    [compCurrentTime, recordHistory]
  );

  const handleLayerToggleEffectParamDiamond = useCallback(
    (layerId: string, effectId: string, param: string) => {
      setTimelineLayers((prev) => {
        const next = prev.map((layer) => {
          if (layer.id !== layerId) {
            return layer;
          }
          return {
            ...layer,
            collapsed: false,
            effects: (layer.effects ?? []).map((effect) =>
              effect.id === effectId
                ? toggleEffectParamDiamondAtTime(effect, param, compCurrentTime)
                : effect
            ),
          };
        });
        recordHistory({ timelineLayers: next });
        return next;
      });
    },
    [compCurrentTime, recordHistory]
  );

  const handleLayerEffectParamChange = useCallback(
    (
      layerId: string,
      effectId: string,
      param: string,
      value: import("../shared/effects").LayerEffectParamValue
    ) => {
      setTimelineLayers((prev) => {
        const next = prev.map((layer) => {
          if (layer.id !== layerId) {
            return layer;
          }
          return {
            ...layer,
            effects: (layer.effects ?? []).map((effect) =>
              effect.id === effectId
                ? applyLayerEffectParamPatch(effect, param, value, compCurrentTime)
                : effect
            ),
          };
        });
        if (!isDraggingHistoryRef.current) {
          queueMicrotask(() => recordHistory({ timelineLayers: next }));
        }
        return next;
      });
    },
    [compCurrentTime, recordHistory]
  );

  const handleKeyframeDragStart = useCallback(() => {
    isDraggingHistoryRef.current = true;
    projectDoc.beginHistoryTransaction();
  }, [projectDoc]);

  const handleKeyframeDragEnd = useCallback(() => {
    isDraggingHistoryRef.current = false;
    projectDoc.commitHistoryTransaction(getFlatState());
  }, [getFlatState, projectDoc]);

  const expandSelectedLayerProperties = useCallback(
    (options?: { transform?: boolean }) => {
      if (!selectedLayer) {
        return;
      }
      handleLayerChange(selectedLayer.id, {
        collapsed: false,
        ...(options?.transform ? { transformExpanded: true } : {}),
      });
    },
    [handleLayerChange, selectedLayer]
  );

  useEffect(() => {
    if (
      timelineRevealState.mode !== "normal" &&
      timelineRevealState.layerId &&
      timelineRevealState.layerId !== selectedLayerId
    ) {
      setTimelineRevealState(NORMAL_TIMELINE_REVEAL);
    }
  }, [selectedLayerId, timelineRevealState.layerId, timelineRevealState.mode]);

  const clearTimelineReveal = useCallback(() => {
    setTimelineRevealState(NORMAL_TIMELINE_REVEAL);
  }, []);

  const revealTimelineProperty = useCallback(
    (property: RevealedProperty, additive: boolean) => {
      if (!selectedLayer) {
        return;
      }
      handleLayerChange(selectedLayer.id, { collapsed: false });

      if (additive) {
        setTimelineRevealState((prev) => {
          if (
            prev.mode === "property-reveal" &&
            prev.layerId === selectedLayer.id &&
            prev.properties.length > 0
          ) {
            if (prev.properties.includes(property)) {
              return prev;
            }
            return {
              mode: "property-reveal",
              layerId: selectedLayer.id,
              properties: [...prev.properties, property],
            };
          }
          return {
            mode: "property-reveal",
            layerId: selectedLayer.id,
            properties: [property],
          };
        });
      } else {
        const isSame =
          timelineRevealState.mode === "property-reveal" &&
          timelineRevealState.layerId === selectedLayer.id &&
          timelineRevealState.properties.length === 1 &&
          timelineRevealState.properties[0] === property;
        setTimelineRevealState(
          isSame
            ? NORMAL_TIMELINE_REVEAL
            : {
                mode: "property-reveal",
                layerId: selectedLayer.id,
                properties: [property],
              }
        );
      }
    },
    [handleLayerChange, selectedLayer, timelineRevealState]
  );

  const revealChangedProperties = useCallback(() => {
    if (!selectedLayer) {
      return;
    }
    const effects = (selectedLayer.effects ?? []).map((effect) => {
      const hasChanges = getEffectParamDefinitions(effect.type).some((def) => {
        if (isEffectParamAnimationEnabled(effect, def.param)) {
          return true;
        }
        const value = effect.params[def.param];
        return typeof value === "number" && Math.abs(value - def.defaultValue) > 0.0001;
      });
      return hasChanges ? { ...effect, collapsed: false } : effect;
    });
    handleLayerChange(selectedLayer.id, {
      collapsed: false,
      effects,
    });
    setTimelineRevealState({
      mode: "changed-only",
      layerId: selectedLayer.id,
      properties: [],
    });
  }, [handleLayerChange, selectedLayer]);

  const previewCacheFingerprint = useMemo(
    () =>
      computePreviewCacheFingerprint(timelineLayers, compWidth, compHeight, fps),
    [compHeight, compWidth, fps, timelineLayers]
  );

  useEffect(() => {
    if (
      previewCache.status === "valid" &&
      previewCache.fingerprint &&
      previewCache.fingerprint !== previewCacheFingerprint
    ) {
      setPreviewCache((prev) => ({ ...prev, status: "stale" }));
      setUseCachedPreview(false);
    }
  }, [previewCache.fingerprint, previewCache.status, previewCacheFingerprint]);

  const handleCachePreview = useCallback(async () => {
    if (timelineLayers.length === 0 || !compositionRenderInput) {
      return;
    }
    const cacheId = activeCompositionId ?? "composition";
    const range = resolvedRenderRange;
    const cachePath = await window.ffmpegStudio.resolvePreviewCachePath(cacheId);
    setPreviewCache((prev) => ({
      ...prev,
      cacheId,
      status: "caching",
      startTime: range.start,
      endTime: range.end,
      fingerprint: previewCacheFingerprint,
    }));

    const args = buildPreviewCacheArgs({
      composition: {
        name: activeComposition?.name ?? "Composition",
        width: compWidth,
        height: compHeight,
        fps,
        duration: compositionDuration,
        workAreaStart,
        workAreaEnd,
      },
      layers: timelineLayers,
      mediaInfoByPath: Object.fromEntries(
        projectItems
          .filter((item) => item.type === "footage" && item.path && item.mediaInfo)
          .map((item) => [
            item.path!,
            { width: item.mediaInfo?.width, height: item.mediaInfo?.height },
          ])
      ),
      selectedLayerId: selectedLayerId,
      renderRange,
      outputPath: cachePath,
      exportCrf: 28,
      exportPreset: "veryfast",
    });

    const primaryInput =
      timelineLayers.find((layer) => layer.sourcePath)?.sourcePath ?? cachePath;
    const job = createPreviewCacheJob({
      inputPath: primaryInput,
      outputPath: cachePath,
      args,
      cacheId,
      compositionName: activeComposition?.name ?? "Composition",
      durationSeconds: range.end - range.start,
    });
    await enqueueBackgroundJobs([job]);
  }, [
    activeComposition?.name,
    activeCompositionId,
    compHeight,
    compWidth,
    compositionDuration,
    compositionRenderInput,
    fps,
    previewCacheFingerprint,
    projectItems,
    renderRange,
    resolvedRenderRange,
    selectedLayerId,
    enqueueBackgroundJobs,
    timelineLayers,
    workAreaEnd,
    workAreaStart,
  ]);

  const handleVidstabAnalyze = useCallback(
    async (layerId: string, effect: LayerEffect) => {
      const layer = timelineLayers.find((entry) => entry.id === layerId);
      if (!layer?.sourcePath) {
        return;
      }
      const trfPath = await window.ffmpegStudio.getVidstabTrfPath(layerId, effect.id);
      const args = buildVidstabDetectArgs(layer.sourcePath, trfPath, effect);
      const job = createVidstabAnalysisJob({
        inputPath: layer.sourcePath,
        trfPath,
        args,
        layerId,
        effectId: effect.id,
        layerName: layer.name,
        durationSeconds: mediaMap[layer.sourcePath]?.mediaInfo?.durationSeconds,
      });
      await enqueueBackgroundJobs([job]);
    },
    [enqueueBackgroundJobs, mediaMap, timelineLayers]
  );

  const handleClearPreviewCache = useCallback(() => {
    setPreviewCache(EMPTY_PREVIEW_CACHE);
    setUseCachedPreview(false);
    showStatus("Preview cache cleared");
  }, [showStatus]);

  const handleLayerEffectsChange = useCallback(
    (layerId: string, effects: LayerEffect[]) => {
      handleLayerChange(layerId, { effects });
    },
    [handleLayerChange]
  );

  const applyActiveToolEffects = useCallback(
    (tool: EditorTool) => {
      if (tool !== "crop" || !selectedLayer) {
        return;
      }
      const media = mediaMap[selectedLayer.sourcePath]?.mediaInfo;
      const crop =
        selectedLayer.crop ??
        createDefaultCrop(media?.width ?? 1920, media?.height ?? 1080);
      handleLayerChange(selectedLayer.id, { crop });
    },
    [handleLayerChange, mediaMap, selectedLayer]
  );

  const handleApplyCropTool = useCallback(() => {
    if (activeTool !== "crop" || !selectedLayer) {
      return;
    }
    handleLayerChange(selectedLayer.id, { cropEnabled: true });
    cropEditSnapshotRef.current = null;
    setActiveTool("selection");
    showStatus("Crop applied");
  }, [activeTool, handleLayerChange, selectedLayer, showStatus]);

  const handleCancelCropTool = useCallback(() => {
    if (activeTool !== "crop" || !selectedLayer) {
      return;
    }
    const snapshot = cropEditSnapshotRef.current;
    if (snapshot?.layerId === selectedLayer.id) {
      handleLayerChange(selectedLayer.id, {
        cropEnabled: snapshot.cropEnabled,
        crop: snapshot.crop,
      });
    }
    cropEditSnapshotRef.current = null;
    setActiveTool("selection");
    showStatus("Crop cancelled");
  }, [activeTool, handleLayerChange, selectedLayer, showStatus]);

  const handleResetCropTool = useCallback(() => {
    if (activeTool !== "crop" || !selectedLayer) {
      return;
    }
    const media = mediaMap[selectedLayer.sourcePath]?.mediaInfo;
    const defaultCrop = createDefaultCrop(media?.width ?? 1920, media?.height ?? 1080);
    handleLayerChange(selectedLayer.id, { crop: defaultCrop });
    showStatus("Crop reset");
  }, [activeTool, handleLayerChange, mediaMap, selectedLayer, showStatus]);

  const handleCancelActiveTool = useCallback(() => {
    if (activeTool === "crop") {
      handleCancelCropTool();
      return;
    }
    setActiveTool("selection");
  }, [activeTool, handleCancelCropTool]);

  const handleActiveToolChange = useCallback(
    (tool: EditorTool) => {
      if (tool === "crop" && !selectedLayer) {
        showStatus("Select a layer first");
        return;
      }
      if (tool === "crop" && selectedLayer) {
        cropEditSnapshotRef.current = {
          layerId: selectedLayer.id,
          cropEnabled: selectedLayer.cropEnabled,
          crop: selectedLayer.crop ? { ...selectedLayer.crop } : undefined,
        };
      }
      setActiveTool(tool);
      applyActiveToolEffects(tool);
    },
    [applyActiveToolEffects, selectedLayer, showStatus]
  );

  const handleSplitLayerAtTime = useCallback(
    (layerId: string, splitTime: number) => {
      const layer = timelineLayers.find((entry) => entry.id === layerId);
      if (!layer) {
        return;
      }
      const result = splitLayerAtTime(
        layer,
        splitTime,
        compWidth,
        compHeight,
        minLayerDuration
      );
      if (!result) {
        return;
      }
      const nextLayers = timelineLayers.map((entry) =>
        entry.id === layer.id ? { ...entry, ...result.left } : entry
      );
      const withRight = reindexLayers([...nextLayers, result.right]);
      setTimelineLayers(withRight);
      updateCompositionFromLayers(withRight);
      setSelectedLayerId(result.right.id);
      recordHistory({ timelineLayers: withRight, selectedLayerId: result.right.id });
      showStatus("Layer split");
    },
    [
      compHeight,
      compWidth,
      minLayerDuration,
      recordHistory,
      showStatus,
      timelineLayers,
      updateCompositionFromLayers,
    ]
  );

  const handleAddEffect = useCallback(
    (type: LayerEffectType) => {
      if (!selectedLayer) {
        return;
      }
      const effect = createLayerEffect(type);
      handleLayerChange(selectedLayer.id, {
        collapsed: false,
        effects: [...(selectedLayer.effects ?? []), { ...effect, collapsed: false }],
      });
      setLeftDockTab("effectControls");
      showStatus(`${effect.name} added`);
    },
    [handleLayerChange, selectedLayer, showStatus]
  );

  const handleApplyRecipe = useCallback(
    async (recipeId: string, options?: { strength?: string }) => {
      const recipe = getFilterRecipeById(recipeId);
      if (!recipe) {
        return;
      }

      const availability = {
        hasFilter: (name: string) => availableNames.has(name),
      };

      const result = applyFilterRecipe({
        recipe,
        selectedLayer,
        composition: { width: compWidth, height: compHeight, fps },
        exportSettings,
        ffmpegFilterAvailability: availability,
        layerMediaInfo: selectedLayer
          ? mediaMap[selectedLayer.sourcePath]?.mediaInfo
          : undefined,
        paramOverrides: options?.strength ? { strength: options.strength } : undefined,
      });

      if (result.blocked) {
        showStatus(result.blockReason ?? "Could not apply preset.");
        return;
      }

      projectDoc.beginHistoryTransaction();

      let nextProjectItems = projectItems;
      let nextTimelineLayers = timelineLayers;
      let nextExportSettings = exportSettings;

      if (result.updatedComposition && activeCompositionId) {
        nextProjectItems = projectItems.map((item) =>
          item.id === activeCompositionId && item.composition
            ? {
                ...item,
                composition: { ...item.composition, ...result.updatedComposition },
              }
            : item
        );
        setProjectItems(nextProjectItems);
      }

      if (result.updatedExportSettings) {
        nextExportSettings = { ...exportSettings, ...result.updatedExportSettings };
        setExportSettings(nextExportSettings);
      }

      if (result.updatedLayer && selectedLayer) {
        nextTimelineLayers = timelineLayers.map((layer) =>
          layer.id === selectedLayer.id ? { ...layer, ...result.updatedLayer } : layer
        );
        setTimelineLayers(nextTimelineLayers);
        if (result.updatedLayer.effects) {
          updateCompositionFromLayers(nextTimelineLayers);
        }
      }

      projectDoc.commitHistoryTransaction({
        ...getFlatState(),
        projectItems: nextProjectItems,
        timelineLayers: nextTimelineLayers,
        exportSettings: { ...nextExportSettings, renderRange },
      });

      if (result.warnings.length > 0) {
        showStatus(result.warnings[0]);
      } else {
        showStatus(`Applied preset: ${recipe.title}`);
      }

      if (result.addedEffects.length > 0) {
        setLeftDockTab("effectControls");
      } else if (result.updatedExportSettings) {
        setRightDockTab("export");
      }

      const vidstabEffect = result.addedEffects.find((effect) => effect.type === "vidstab");
      if (result.jobsToCreate.includes("analysis") && selectedLayer && vidstabEffect) {
        await handleVidstabAnalyze(selectedLayer.id, vidstabEffect);
      }
      if (result.jobsToCreate.includes("preview-cache")) {
        await handleCachePreview();
      }
    },
    [
      activeCompositionId,
      availableNames,
      compHeight,
      compWidth,
      exportSettings,
      fps,
      getFlatState,
      handleCachePreview,
      handleVidstabAnalyze,
      mediaMap,
      projectDoc,
      projectItems,
      renderRange,
      selectedLayer,
      showStatus,
      timelineLayers,
      updateCompositionFromLayers,
    ]
  );

  const resetToEmptyProject = useCallback(() => {
    const empty = createDefaultFlatEditorState();
    setProjectItems([]);
    setTimelineLayers([]);
    setJobs([]);
    setCompCurrentTime(0);
    setExportSettings({ ...DEFAULT_EXPORT_SETTINGS });
    setActiveCompositionId(null);
    setSelectedLayerId(null);
    setSelectedProjectItemId(null);
    setSelectedProjectItemIds([]);
    setSelectedJobId(null);
    setWorkAreaStart(0);
    setWorkAreaEnd(0);
    setCompStatesById({});
    setCompNavStack([]);
    setSelectedLayerIds([]);
    setRenderRange("full");
    setMediaMap({});
    setImportError(null);
    setLogLines([]);
    setCompositionSettingsTargetId(null);
    setCreateCompFromFootageTarget(null);
    projectDoc.replaceHistory(empty);
    projectDoc.setProjectMeta({
      projectId: createInitialProjectMeta().projectId,
      createdAt: new Date().toISOString(),
      projectPath: null,
      projectName: "Untitled Project",
    });
    projectDoc.markSaved();
  }, [projectDoc]);

  const loadProjectData = useCallback(
    async (project: FFmpegStudioProject) => {
      const flat = flatFromLoadedProject(project);
      await applyFlatEditorState(flat);
      projectDoc.replaceHistory(flat);
      projectDoc.setProjectMeta({
        projectId: project.projectId,
        createdAt: project.createdAt,
        projectPath: project.projectPath ?? null,
        projectName: project.projectName,
      });
      projectDoc.markSaved();
      await window.ffmpegStudio.clearAutosave(project.projectId);
    },
    [applyFlatEditorState, projectDoc]
  );

  const handleSaveProject = useCallback(async () => {
    const project = projectDoc.buildProjectFile(getFlatState());
    let targetPath = projectDoc.projectPath;
    if (!targetPath) {
      targetPath = await window.ffmpegStudio.saveProjectDialog(
        `${project.projectName}.ffstudio`
      );
      if (!targetPath) {
        return false;
      }
    }
    await window.ffmpegStudio.saveProject(targetPath, { ...project, projectPath: targetPath });
    projectDoc.setProjectMeta({ projectPath: targetPath });
    projectDoc.markSaved();
    await window.ffmpegStudio.clearAutosave(project.projectId);
    return true;
  }, [getFlatState, projectDoc]);

  const handleSaveProjectAs = useCallback(async () => {
    const project = projectDoc.buildProjectFile(getFlatState());
    const targetPath = await window.ffmpegStudio.saveProjectDialog(
      projectDoc.projectPath ?? `${project.projectName}.ffstudio`
    );
    if (!targetPath) {
      return false;
    }
    await window.ffmpegStudio.saveProject(targetPath, { ...project, projectPath: targetPath });
    projectDoc.setProjectMeta({ projectPath: targetPath, projectName: project.projectName });
    projectDoc.markSaved();
    await window.ffmpegStudio.clearAutosave(project.projectId);
    return true;
  }, [getFlatState, projectDoc]);

  const handleOpenProject = useCallback(async () => {
    const choice = await projectDoc.confirmDiscardChanges();
    if (choice === "cancel") {
      return;
    }
    if (choice === "save") {
      const saved = await handleSaveProject();
      if (!saved) {
        return;
      }
    }
    const filePath = await window.ffmpegStudio.openProjectDialog();
    if (!filePath) {
      return;
    }
    const project = await window.ffmpegStudio.loadProjectFromPath(filePath);
    await loadProjectData(project);
  }, [handleSaveProject, loadProjectData, projectDoc]);

  const handleNewProject = useCallback(async () => {
    const choice = await projectDoc.confirmDiscardChanges();
    if (choice === "cancel") {
      return;
    }
    if (choice === "save") {
      const saved = await handleSaveProject();
      if (!saved) {
        return;
      }
    }
    resetToEmptyProject();
  }, [handleSaveProject, projectDoc, resetToEmptyProject]);

  const handleUndo = useCallback(() => {
    const snapshot = projectDoc.undo(getFlatState());
    if (snapshot) {
      void applyFlatEditorState(projectDoc.applySnapshot(snapshot));
    }
  }, [applyFlatEditorState, getFlatState, projectDoc]);

  const handleRedo = useCallback(() => {
    const snapshot = projectDoc.redo(getFlatState());
    if (snapshot) {
      void applyFlatEditorState(projectDoc.applySnapshot(snapshot));
    }
  }, [applyFlatEditorState, getFlatState, projectDoc]);

  const handleRelinkMedia = useCallback(
    async (itemId: string) => {
      const newPath = await window.ffmpegStudio.relinkMediaDialog();
      if (!newPath) {
        return;
      }
      const mediaInfo = await probeFile(newPath);
      mediaVisualCache.invalidatePath(
        projectItems.find((entry) => entry.id === itemId)?.path ?? ""
      );
      const relinked = relinkFootageInState({
        projectItems,
        timelineLayers,
        jobs,
        itemId,
        newPath,
        mediaInfo,
      });
      setProjectItems(relinked.projectItems);
      setTimelineLayers(relinked.timelineLayers);
      setJobs(relinked.jobs);
      const footage = relinked.projectItems.find((entry) => entry.id === itemId);
      if (footage?.path && mediaInfo?.durationSeconds) {
        void finalizeImportedFootage(footage);
        void generateFootageThumbnail(footage);
      }
      recordHistory();
    },
    [
      finalizeImportedFootage,
      generateFootageThumbnail,
      jobs,
      probeFile,
      projectItems,
      recordHistory,
      timelineLayers,
    ]
  );

  const handleBeforeClose = useCallback(async () => {
    if (!projectDoc.isDirty) {
      await window.ffmpegStudio.allowClose();
      return;
    }
    const choice = await projectDoc.confirmDiscardChanges();
    if (choice === "cancel") {
      return;
    }
    if (choice === "save") {
      const saved = await handleSaveProject();
      if (!saved) {
        return;
      }
    }
    await window.ffmpegStudio.allowClose();
  }, [handleSaveProject, projectDoc]);

  const handleClearKeyframeSelection = useCallback(() => {
    setSelectedKeyframes([]);
    setKeyframeContextMenu(null);
  }, []);

  const handleSelectKeyframe = useCallback(
    (ref: SelectedKeyframeRef, options?: { additive?: boolean }) => {
      if (options?.additive) {
        setSelectedKeyframes((prev) => {
          const exists = prev.some((entry) => refsMatch(entry, ref));
          if (exists) {
            return prev.filter((entry) => !refsMatch(entry, ref));
          }
          return [...prev, ref];
        });
      } else {
        setSelectedKeyframes([ref]);
      }
    },
    []
  );

  const handleSetSelectedKeyframesInterpolation = useCallback(
    (interpolation: KeyframeInterpolation) => {
      if (selectedKeyframes.length === 0) {
        return;
      }
      setTimelineLayers((prev) => {
        const next = setSelectedKeyframesInterpolation(prev, selectedKeyframes, interpolation);
        updateCompositionFromLayers(next);
        recordHistory({ timelineLayers: next });
        return next;
      });
      showStatus(`Keyframe interpolation: ${interpolation === "easeInOut" ? "Easy Ease" : interpolation}`);
    },
    [recordHistory, selectedKeyframes, showStatus, updateCompositionFromLayers]
  );

  const handleDeleteSelectedKeyframes = useCallback(() => {
    if (selectedKeyframes.length === 0) {
      return false;
    }
    setTimelineLayers((prev) => {
      const next = deleteSelectedKeyframesFromLayers(prev, selectedKeyframes);
      recordHistory({ timelineLayers: next });
      return next;
    });
    setSelectedKeyframes([]);
    setKeyframeContextMenu(null);
    showStatus("Keyframes deleted");
    return true;
  }, [recordHistory, selectedKeyframes, showStatus]);

  const handleCopyKeyframes = useCallback(() => {
    if (selectedKeyframes.length === 0 || !selectedLayer) {
      return;
    }
    const result = buildKeyframeClipboard(selectedLayer, selectedKeyframes);
    if ("error" in result) {
      showStatus(result.error);
      return;
    }
    setKeyframeClipboard(result);
    showStatus(`Copied ${result.keyframes.length} keyframe${result.keyframes.length === 1 ? "" : "s"}`);
  }, [selectedKeyframes, selectedLayer, showStatus]);

  const handlePasteKeyframes = useCallback(() => {
    if (!keyframeClipboard || !selectedLayerId || !selectedLayer) {
      return;
    }

    if (keyframeClipboard.kind === "effect") {
      const matches = (selectedLayer.effects ?? []).filter(
        (effect) => effect.type === keyframeClipboard.effectType
      );
      if (matches.length === 0) {
        showStatus("No matching effect on layer for paste");
        return;
      }
      if (matches.length > 1) {
        showStatus("Paste requires a single effect of this type on layer");
        return;
      }
    }

    setTimelineLayers((prev) => {
      const next = prev.map((layer) => {
        if (layer.id !== selectedLayerId) {
          return layer;
        }
        if (keyframeClipboard.kind === "effect") {
          const target = (layer.effects ?? []).find(
            (effect) => effect.type === keyframeClipboard.effectType
          );
          if (!target) {
            return layer;
          }
          return pasteKeyframeClipboard(
            layer,
            keyframeClipboard,
            compCurrentTime,
            target.id
          );
        }
        return pasteKeyframeClipboard(layer, keyframeClipboard, compCurrentTime);
      });
      recordHistory({ timelineLayers: next });
      return next;
    });
    showStatus(`Pasted ${keyframeClipboard.keyframes.length} keyframe${keyframeClipboard.keyframes.length === 1 ? "" : "s"} at playhead`);
  }, [compCurrentTime, keyframeClipboard, recordHistory, selectedLayer, selectedLayerId, showStatus]);

  const handleDeleteSelection = useCallback(() => {
    if (handleDeleteSelectedKeyframes()) {
      return;
    }

    if (selectedLayerId) {
      setTimelineLayers((prev) => {
        const next = reindexLayers(prev.filter((layer) => layer.id !== selectedLayerId));
        updateCompositionFromLayers(next);
        return next;
      });
      setSelectedLayerId(null);
      recordHistory();
      return;
    }

    if (selectedProjectItemId) {
      const item = projectItems.find((entry) => entry.id === selectedProjectItemId);
      if (!item || item.type !== "footage" || !item.path) {
        return;
      }
      const path = item.path;
      setProjectItems((prev) => prev.filter((entry) => entry.id !== selectedProjectItemId));
      setTimelineLayers((prev) => reindexLayers(prev.filter((layer) => layer.sourcePath !== path)));
      setJobs((prev) => prev.filter((job) => job.inputPath !== path));
      setSelectedProjectItemId(null);
      recordHistory();
    }
  }, [
    handleDeleteSelectedKeyframes,
    projectItems,
    recordHistory,
    selectedLayerId,
    selectedProjectItemId,
    updateCompositionFromLayers,
  ]);

  const handleLayerDragStart = useCallback(() => {
    isDraggingHistoryRef.current = true;
    projectDoc.beginHistoryTransaction();
  }, [projectDoc]);

  const handleLayerDragEnd = useCallback(() => {
    isDraggingHistoryRef.current = false;
    projectDoc.commitHistoryTransaction(getFlatState());
  }, [getFlatState, projectDoc]);

  const applyLayerPatch = useCallback(
    (layerId: string, patch: Partial<TimelineLayer> | null, status?: string) => {
      if (!patch) {
        return false;
      }
      handleLayerChange(layerId, patch);
      if (status) {
        showStatus(status);
      }
      return true;
    },
    [handleLayerChange, showStatus]
  );

  const commandHandlers = useMemo<CommandHandlers>(
    () => ({
      "playback.toggle": () => videoPreviewRef.current?.togglePlay(),
      "playback.goToStart": () => videoPreviewRef.current?.seekToCompTime(0),
      "playback.goToEnd": () => videoPreviewRef.current?.seekToCompTime(compositionDuration),
      "playback.previousFrame": () => videoPreviewRef.current?.stepFrame(-1),
      "playback.nextFrame": () => videoPreviewRef.current?.stepFrame(1),
      "workArea.setStart": () => {
        if (Math.abs(workAreaStart - compCurrentTime) < 0.001) {
          return;
        }
        setWorkAreaStart(compCurrentTime);
        recordHistory({ workAreaStart: compCurrentTime });
        showStatus("Work Area Start set");
      },
      "workArea.setEnd": () => {
        if (Math.abs(workAreaEnd - compCurrentTime) < 0.001) {
          return;
        }
        setWorkAreaEnd(compCurrentTime);
        recordHistory({ workAreaEnd: compCurrentTime });
        showStatus("Work Area End set");
      },
      "layer.moveStartToPlayhead": () => {
        if (!selectedLayer) {
          return;
        }
        const patch = moveLayerStartToPlayhead(selectedLayer, compCurrentTime);
        applyLayerPatch(selectedLayer.id, patch, patch ? "Layer start moved to playhead" : undefined);
      },
      "layer.moveEndToPlayhead": () => {
        if (!selectedLayer) {
          return;
        }
        const patch = moveLayerEndToPlayhead(selectedLayer, compCurrentTime);
        applyLayerPatch(selectedLayer.id, patch, patch ? "Layer end moved to playhead" : undefined);
      },
      "layer.trimInToPlayhead": () => {
        if (!selectedLayer) {
          return;
        }
        const patch = trimLayerInToPlayhead(selectedLayer, compCurrentTime);
        applyLayerPatch(selectedLayer.id, patch, patch ? "Layer trimmed in" : undefined);
      },
      "layer.trimOutToPlayhead": () => {
        if (!selectedLayer) {
          return;
        }
        const patch = trimLayerOutToPlayhead(selectedLayer, compCurrentTime, minLayerDuration);
        applyLayerPatch(selectedLayer.id, patch, patch ? "Layer trimmed out" : undefined);
      },
      "layer.moveDown": () => {
        if (!selectedLayerId) {
          return;
        }
        const reordered = moveLayerInStack(timelineLayers, selectedLayerId, "down");
        if (!reordered) {
          return;
        }
        setTimelineLayers(reordered);
        recordHistory({ timelineLayers: reordered });
        showStatus("Layer moved down");
      },
      "layer.moveUp": () => {
        if (!selectedLayerId) {
          return;
        }
        const reordered = moveLayerInStack(timelineLayers, selectedLayerId, "up");
        if (!reordered) {
          return;
        }
        setTimelineLayers(reordered);
        recordHistory({ timelineLayers: reordered });
        showStatus("Layer moved up");
      },
      "layer.moveToBottom": () => {
        if (!selectedLayerId) {
          return;
        }
        const reordered = moveLayerInStack(timelineLayers, selectedLayerId, "bottom");
        if (!reordered) {
          return;
        }
        setTimelineLayers(reordered);
        recordHistory({ timelineLayers: reordered });
        showStatus("Layer moved to bottom");
      },
      "layer.moveToTop": () => {
        if (!selectedLayerId) {
          return;
        }
        const reordered = moveLayerInStack(timelineLayers, selectedLayerId, "top");
        if (!reordered) {
          return;
        }
        setTimelineLayers(reordered);
        recordHistory({ timelineLayers: reordered });
        showStatus("Layer moved to top");
      },
      "layer.delete": () => handleDeleteSelection(),
      "layer.duplicate": () => {
        if (!selectedLayer) {
          return;
        }
        const copy = duplicateTimelineLayer(selectedLayer);
        const maxIndex = timelineLayers.reduce((max, layer) => Math.max(max, layer.index), 0);
        copy.index = maxIndex + 1;
        const nextLayers = reindexLayers([...timelineLayers, copy]);
        setTimelineLayers(nextLayers);
        setSelectedLayerId(copy.id);
        recordHistory({ timelineLayers: nextLayers, selectedLayerId: copy.id });
        showStatus("Layer duplicated");
      },
      "layer.splitAtPlayhead": () => {
        if (!selectedLayer) {
          return;
        }
        handleSplitLayerAtTime(selectedLayer.id, compCurrentTime);
      },
      "composition.precompose": () => handlePrecompose(),
      "tool.selection": () => handleActiveToolChange("selection"),
      "tool.razor": () => handleActiveToolChange("razor"),
      "tool.crop": () => handleActiveToolChange("crop"),
      "tool.escape": () => handleCancelActiveTool(),
      "tool.applyCrop": () => handleApplyCropTool(),
      "property.showPosition": (event) =>
        revealTimelineProperty("position", event?.shiftKey ?? false),
      "property.showScale": (event) =>
        revealTimelineProperty("scale", event?.shiftKey ?? false),
      "property.showRotation": (event) =>
        revealTimelineProperty("rotation", event?.shiftKey ?? false),
      "property.showOpacity": (event) =>
        revealTimelineProperty("opacity", event?.shiftKey ?? false),
      "property.showAnchor": (event) =>
        revealTimelineProperty("anchor", event?.shiftKey ?? false),
      "property.showAllChanged": () => revealChangedProperties(),
      "keyframe.copy": () => handleCopyKeyframes(),
      "keyframe.paste": () => handlePasteKeyframes(),
      "keyframe.easyEase": () => handleSetSelectedKeyframesInterpolation("easeInOut"),
      "keyframe.previous": () => {
        if (!selectedLayer) {
          return;
        }
        const time = findAdjacentKeyframeTime(selectedLayer, compCurrentTime, -1);
        if (time !== null) {
          handleSeek(time);
        }
      },
      "keyframe.next": () => {
        if (!selectedLayer) {
          return;
        }
        const time = findAdjacentKeyframeTime(selectedLayer, compCurrentTime, 1);
        if (time !== null) {
          handleSeek(time);
        }
      },
      "animation.togglePosition": () => {
        if (selectedLayerId) {
          handleLayerToggleTransformAnimation(selectedLayerId, "position");
        }
      },
      "animation.toggleScale": () => {
        if (selectedLayerId) {
          handleLayerToggleTransformAnimation(selectedLayerId, "scale");
        }
      },
      "animation.toggleRotation": () => {
        if (selectedLayerId) {
          handleLayerToggleTransformAnimation(selectedLayerId, "rotation");
        }
      },
      "animation.toggleOpacity": () => {
        if (selectedLayerId) {
          handleLayerToggleTransformAnimation(selectedLayerId, "opacity");
        }
      },
      "transform.reset": () => {
        if (!selectedLayer) {
          return;
        }
        handleLayerChange(selectedLayer.id, {
          transform: resetTransform(compWidth, compHeight),
        });
        showStatus("Transform reset");
      },
      "edit.undo": () => handleUndo(),
      "edit.redo": () => handleRedo(),
      "project.save": () => void handleSaveProject(),
      "project.saveAs": () => void handleSaveProjectAs(),
      "project.open": () => void handleOpenProject(),
      "project.new": () => void handleNewProject(),
    }),
    [
      applyLayerPatch,
      compCurrentTime,
      compHeight,
      compWidth,
      compositionDuration,
      expandSelectedLayerProperties,
      revealChangedProperties,
      revealTimelineProperty,
      handleActiveToolChange,
      handleApplyCropTool,
      handleCancelActiveTool,
      handleCopyKeyframes,
      handleDeleteSelection,
      handleLayerChange,
      handlePasteKeyframes,
      handleSeek,
      handleSetSelectedKeyframesInterpolation,
      handlePrecompose,
      handleSplitLayerAtTime,
      handleLayerToggleTransformAnimation,
      handleNewProject,
      handleOpenProject,
      handleRedo,
      handleSaveProject,
      handleSaveProjectAs,
      handleUndo,
      mediaMap,
      minLayerDuration,
      recordHistory,
      selectedLayer,
      selectedLayerId,
      showStatus,
      timelineLayers,
      updateCompositionFromLayers,
      workAreaEnd,
      workAreaStart,
    ]
  );

  useCommandShortcuts(commandHandlers);

  const { isSpacePanActive, markSpacePanOccurred } = useSpacePan({
    onTogglePlay: () => videoPreviewRef.current?.togglePlay(),
  });

  const handleRender = async () => {
    if (timelineLayers.length === 0 || compositionDuration <= 0) {
      return;
    }

    const compName = compositionRenderInput.composition.name;
    const parentJobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const plan = await buildPrecompRenderPlan(
      compositionRenderInput,
      parentJobId,
      {
        projectItems,
        getLayersForComposition,
        resolvePrecompCachePath: (renderJobId, layerId) =>
          window.ffmpegStudio.resolvePrecompRenderCachePath(renderJobId, layerId),
      }
    );

    const built = plan.parentBuilt;
    const primaryInput =
      built.renderLayers[0]?.sourcePath ??
      timelineLayers.find((layer) => layer.sourcePath)?.sourcePath ??
      Object.values(plan.parentInput.precompSourceByLayerId ?? {})[0] ??
      compositionRenderInput.outputPath;

    const compositionJob = createCompositionRenderJob(
      primaryInput,
      compositionRenderInput.outputPath,
      built.args,
      built.renderDuration,
      compName,
      parentJobId
    );

    if (plan.cleanupPaths.length > 0) {
      precompCleanupByParentJobRef.current[parentJobId] = plan.cleanupPaths;
    }

    setLogLines([
      `Render Composition: ${compName}`,
      "Render mode: Multi-layer composition",
      plan.precompJobs.length > 0
        ? `Precomp passes: ${plan.precompJobs.length} (nested → intermediate MP4)`
        : null,
      `Video layers: ${built.videoLayerCount}`,
      `Audio layers: ${built.audioLayerCount}`,
      formatRenderRangeLabel(built.range),
      `Output: ${compositionRenderInput.outputPath}`,
      ...built.renderCompat.summaryLines,
      ...plan.warnings.map((warning) => `Warning: ${warning}`),
    ].filter((line): line is string => Boolean(line)));

    const jobsToEnqueue = [...plan.precompJobs, compositionJob];
    await enqueueBackgroundJobs(jobsToEnqueue);
    refreshFfmpegStatus();
  };

  const handleRemove = (jobId: string) => {
    setJobs((prev) => prev.filter((item) => item.id !== jobId));
    if (selectedJobId === jobId) {
      setSelectedJobId(null);
    }
  };

  useEffect(() => {
    const unsubMenu = window.ffmpegStudio.onMenuAction((action: MenuAction) => {
      switch (action) {
        case "new-project":
          void handleNewProject();
          break;
        case "open-project":
          void handleOpenProject();
          break;
        case "save-project":
          void handleSaveProject();
          break;
        case "save-project-as":
          void handleSaveProjectAs();
          break;
        case "import-media":
          void handleAddMedia();
          break;
        case "render":
          void handleRender();
          break;
        case "exit":
          void handleBeforeClose();
          break;
        case "undo":
          handleUndo();
          break;
        case "redo":
          handleRedo();
          break;
        case "delete":
          handleDeleteSelection();
          break;
        case "keyboard-shortcuts":
          setShortcutsOpen(true);
          break;
        default:
          break;
      }
    });
    const unsubClose = window.ffmpegStudio.onBeforeClose(() => {
      void handleBeforeClose();
    });
    return () => {
      unsubMenu();
      unsubClose();
    };
  }, [
    handleAddMedia,
    handleBeforeClose,
    handleDeleteSelection,
    handleNewProject,
    handleOpenProject,
    handleRedo,
    handleRender,
    handleSaveProject,
    handleSaveProjectAs,
    handleUndo,
  ]);

  useEffect(() => {
    const prev = prevStartupStageRef.current;
    prevStartupStageRef.current = startup.stage;
    if (prev === "ready" || startup.stage !== "ready") {
      return;
    }
    setStartupOverlayFading(true);
    const timer = window.setTimeout(() => setStartupOverlayFading(false), 480);
    return () => window.clearTimeout(timer);
  }, [startup.stage]);

  useEffect(() => {
    if (startup.stage !== "ready" || startupCheckedRef.current) {
      return;
    }
    startupCheckedRef.current = true;

    async function checkAutosave() {
      if (window.ffmpegStudio.previewE2eEnabled || window.ffmpegStudio.previewSelftestEnabled) {
        const autosave = await window.ffmpegStudio.loadAutosave();
        if (autosave?.projectId) {
          await window.ffmpegStudio.clearAutosave(autosave.projectId);
        }
        return;
      }

      const autosave = await window.ffmpegStudio.loadAutosave();
      if (!autosave?.projectPath) {
        if (autosave?.projectId) {
          await window.ffmpegStudio.clearAutosave(autosave.projectId);
        }
        return;
      }
      const choice = await window.ffmpegStudio.confirmRestoreAutosave();
      if (choice === "restore") {
        await loadProjectData(autosave);
      } else {
        await window.ffmpegStudio.clearAutosave(autosave.projectId);
      }
    }

    void checkAutosave();
  }, [loadProjectData]);

  useEffect(() => {
    if (!projectDoc.isDirty || !projectDoc.projectPath) {
      return;
    }
    const timer = window.setInterval(() => {
      const project = projectDoc.buildProjectFile(getFlatState());
      if (!project.projectPath) {
        return;
      }
      void window.ffmpegStudio.saveAutosave(project).then(() => {
        projectDoc.markAutosaved();
      });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [getFlatState, projectDoc.isDirty, projectDoc.projectPath]);

  const handleRenderRangeChange = useCallback(
    (range: RenderRange) => {
      if (range === renderRange) {
        return;
      }
      setRenderRange(range);
      recordHistory({
        exportSettings: {
          ...getFlatState().exportSettings,
          renderRange: range,
        },
      });
    },
    [getFlatState, recordHistory, renderRange]
  );

  useEffect(() => {
    if (compositionDuration > 0 && workAreaEnd <= workAreaStart) {
      setWorkAreaEnd(compositionDuration);
    }
  }, [compositionDuration, workAreaEnd, workAreaStart]);

  const canRender =
    (ffmpegStatus?.ok ?? false) &&
    timelineLayers.length > 0 &&
    compositionDuration > 0 &&
    timelineLayers.some((layer) => layer.enabled && layer.hasVideo);

  const projectItemsWithMedia = useMemo(
    () =>
      projectItems.map((item) =>
        item.type === "footage" && item.path
          ? { ...item, mediaInfo: item.mediaInfo ?? mediaMap[item.path]?.mediaInfo }
          : item
      ),
    [projectItems, mediaMap]
  );

  const backgroundTaskSummary = useMemo(
    () => getRunningJobSummary(jobs) ?? (isRunning ? "Processing…" : "Idle"),
    [isRunning, jobs]
  );

  const analysisBusyEffectId = useMemo(() => {
    const running = jobs.find(
      (job) => job.jobKind === "analysis" && job.status === "running"
    );
    return running?.relatedEffectId ?? null;
  }, [jobs]);

  const previewPathBySourcePath = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of projectItemsWithMedia) {
      if (item.type === "footage" && item.path) {
        const safe = getSafePreviewPathForItem(item);
        if (safe) {
          map[item.path] = safe;
        }
      }
    }
    return map;
  }, [projectItemsWithMedia]);

  const footageBySourcePath = useMemo(() => {
    const map: Record<string, ProjectItem> = {};
    for (const item of projectItemsWithMedia) {
      if (item.type === "footage" && item.path) {
        map[item.path] = item;
      }
    }
    return map;
  }, [projectItemsWithMedia]);

  const showStartupOverlay = startup.isVisible || startupOverlayFading;

  return (
    <>
    <StartupOverlay
      stage={startup.stage}
      stageLabel={startup.stageLabel}
      visible={showStartupOverlay}
      fading={startupOverlayFading}
      isSlow={startup.isSlow}
      error={startup.error}
      canContinueAnyway={startup.canContinueAnyway}
      onRetry={startup.retry}
      onContinueAnyway={startup.continueAnyway}
    />
    {startup.stage === "ready" && (
    <StudioLayout
      videoPreviewRef={videoPreviewRef}
      ffmpegStatus={ffmpegStatus}
      isRunning={isRunning}
      canRender={canRender}
      jobs={jobs}
      selectedJobId={selectedJobId ?? selectedJob?.id ?? null}
      projectItems={projectItemsWithMedia}
      selectedProjectItemId={selectedProjectItemId}
      selectedProjectItemIds={selectedProjectItemIds}
      timelineLayers={timelineLayers}
      selectedLayerId={selectedLayerId}
      selectedLayer={selectedLayer}
      activeCompositionName={activeComposition?.name ?? null}
      activeCompositionId={activeCompositionId}
      onSwitchComposition={(compId) => {
        setCompNavStack([]);
        switchComposition(compId);
      }}
      onNewComposition={handleNewComposition}
      onCompositionSettings={setCompositionSettingsTargetId}
      onDuplicateComposition={handleDuplicateComposition}
      onDeleteComposition={handleDeleteComposition}
      onRenameComposition={handleRenameComposition}
      onOpenComposition={handleOpenComposition}
      onOpenPrecompLayer={handleOpenPrecompLayer}
      compBreadcrumbs={compBreadcrumbs}
      canNavigateCompBack={compNavStack.length > 0}
      onNavigateCompositionBreadcrumb={handleNavigateCompositionBreadcrumb}
      onNavigateCompBack={handleNavigateCompBack}
      getLayersForComposition={getLayersForComposition}
      compositionDuration={compositionDuration}
      compWidth={compWidth}
      compHeight={compHeight}
      fps={fps}
      sourceDurations={sourceDurations}
      importError={importError}
      previewPathBySourcePath={previewPathBySourcePath}
      footageBySourcePath={footageBySourcePath}
      previewErrorsByPath={previewErrorsByPath}
      proxyGeneratingIds={proxyGeneratingIds}
      onCreatePreviewProxy={handleCreatePreviewProxy}
      onRetryChromiumPreview={(itemId) => void handleRetryChromiumPreview(itemId)}
      onBatchApplyPreset={() => setBatchApplyDialogOpen(true)}
      onBatchCreateProxies={() => void handleBatchCreateProxies()}
      onBatchAddToQueue={() => void handleBatchAddToQueue()}
      onBatchApply={(options) => void handleBatchApplyConfirm(options)}
      selectedFootageItems={selectedFootageItems}
      onPreviewError={handlePreviewError}
      compCurrentTime={compCurrentTime}
      exportSettings={{ ...exportSettings, renderRange }}
      commandPreview={commandPreview}
      commandPreviewNote={commandPreviewNote}
      logLines={logLines}
      bottomTab={bottomTab}
      settingsOpen={settingsOpen}
      seekTime={seekTime}
      isPlaying={isPlaying}
      playbackRate={playbackRate}
      loopPlayback={loopPlayback}
      videoSize={videoSize}
      onBottomTabChange={setBottomTab}
      onSelectJob={setSelectedJobId}
      onSelectProjectItem={handleSelectProjectItem}
      onSelectLayer={handleSelectLayer}
      onLayerChange={handleLayerChange}
      onTransformChange={handleTransformChange}
      leftDockTab={leftDockTab}
      onLeftDockTabChange={setLeftDockTab}
      rightDockTab={rightDockTab}
      onRightDockTabChange={setRightDockTab}
      timelineRevealState={timelineRevealState}
      playbackDiagnostics={playbackDiagnostics}
      onPlaybackDiagnostics={handlePlaybackDiagnostics}
      onClearTimelineReveal={clearTimelineReveal}
      previewCache={previewCache}
      previewBufferState={previewBufferState}
      onPreviewBufferStateChange={setPreviewBufferState}
      useCachedPreview={useCachedPreview}
      onCachePreview={handleCachePreview}
      onClearPreviewCache={handleClearPreviewCache}
      cachePreviewBusy={cachePreviewBusy}
      onLayerEffectsChange={handleLayerEffectsChange}
      onSelectedLayerToggleEffectParamAnimation={(effectId, param) => {
        if (selectedLayerId) {
          handleLayerToggleEffectParamAnimation(selectedLayerId, effectId, param);
        }
      }}
      onSelectedLayerToggleEffectParamDiamond={(effectId, param) => {
        if (selectedLayerId) {
          handleLayerToggleEffectParamDiamond(selectedLayerId, effectId, param);
        }
      }}
      onSelectedLayerEffectParamChange={(effectId, param, value) => {
        if (selectedLayerId) {
          handleLayerEffectParamChange(selectedLayerId, effectId, param, value);
        }
      }}
      timelineViewMode={timelineViewMode}
      onLayerTransformChange={handleLayerTransformChange}
      onLayerToggleTransformAnimation={handleLayerToggleTransformAnimation}
      onLayerToggleKeyframeDiamond={handleLayerToggleKeyframeDiamond}
      onLayerToggleEffectParamAnimation={handleLayerToggleEffectParamAnimation}
      onLayerToggleEffectParamDiamond={handleLayerToggleEffectParamDiamond}
      onLayerEffectParamChange={handleLayerEffectParamChange}
      onTimelineViewModeChange={setTimelineViewMode}
      onAddEffect={handleAddEffect}
      onApplyRecipe={handleApplyRecipe}
      onImportMedia={handleAddMedia}
      onImportPaths={(paths, source) => importMediaFiles(paths, source)}
      onRender={handleRender}
      onRemoveJob={handleRemove}
      onCancelJob={cancelBackgroundJob}
      backgroundTaskSummary={backgroundTaskSummary}
      onVidstabAnalyze={handleVidstabAnalyze}
      analysisBusyEffectId={analysisBusyEffectId}
      onOpenOutput={(path) => window.ffmpegStudio.openOutputFolder(path)}
      onOpenSettings={() => setSettingsOpen(true)}
      onCloseSettings={() => setSettingsOpen(false)}
      onSettingsSaved={async () => {
        await refreshFfmpegStatus();
        await refreshAppSettings();
      }}
      previewBackend={previewBackend}
      onCropChange={handleCropChange}
      onApplyCrop={handleApplyCropTool}
      onCancelCrop={handleCancelCropTool}
      onResetCrop={handleResetCropTool}
      onCompCurrentTimeChange={handleCompCurrentTimeChange}
      onExportSettingsChange={handleExportSettingsChange}
      onSeek={handleSeek}
      onPlayingChange={setIsPlaying}
      onPlaybackRateChange={setPlaybackRate}
      onToggleLoop={() => setLoopPlayback((value) => !value)}
      projectName={projectDoc.projectName}
      projectPath={projectDoc.projectPath}
      isDirty={projectDoc.isDirty}
      saveStatus={projectDoc.saveStatus}
      canUndo={projectDoc.canUndo}
      canRedo={projectDoc.canRedo}
      onLayerDragStart={handleLayerDragStart}
      onLayerDragEnd={handleLayerDragEnd}
      onRelinkMedia={handleRelinkMedia}
      workAreaStart={workAreaStart}
      workAreaEnd={workAreaEnd}
      renderRange={renderRange}
      resolvedRenderRange={resolvedRenderRange}
      compositionOutputPath={compositionRenderInput.outputPath}
      onRenderRangeChange={handleRenderRangeChange}
      statusMessage={statusMessage}
      shortcutsOpen={shortcutsOpen}
      onCloseShortcuts={() => setShortcutsOpen(false)}
      onStatusHint={showStatus}
      activeTool={activeTool}
      onActiveToolChange={handleActiveToolChange}
      isSpacePanActive={isSpacePanActive}
      onSpacePanOccurred={markSpacePanOccurred}
      onSplitLayer={handleSplitLayerAtTime}
      mediaCache={mediaVisualCache}
      selectedKeyframes={selectedKeyframes}
      onSelectKeyframe={handleSelectKeyframe}
      onClearKeyframeSelection={handleClearKeyframeSelection}
      onMoveKeyframe={handleMoveKeyframe}
      onMoveEffectKeyframe={handleMoveEffectKeyframe}
      onKeyframeDragStart={handleKeyframeDragStart}
      onKeyframeDragEnd={handleKeyframeDragEnd}
      onSetKeyframeInterpolation={handleSetSelectedKeyframesInterpolation}
      onOpenKeyframeContextMenu={setKeyframeContextMenu}
      keyframeContextMenu={keyframeContextMenu}
      onCloseKeyframeContextMenu={() => setKeyframeContextMenu(null)}
      onKeyframeContextDelete={handleDeleteSelectedKeyframes}
      onKeyframeContextCopy={handleCopyKeyframes}
    />
    )}
    {batchApplyDialogOpen && (
      <BatchApplyRecipeDialog
        items={selectedFootageItems}
        onCancel={() => setBatchApplyDialogOpen(false)}
        onApply={(options) => void handleBatchApplyConfirm(options)}
      />
    )}
    {compositionSettingsTargetId && (() => {
      const compItem = projectItems.find(
        (item) => item.id === compositionSettingsTargetId && item.type === "composition"
      );
      if (!compItem) {
        return null;
      }
      return (
        <CompositionSettingsDialog
          initial={compositionMetaToSettings(compItem)}
          onSave={handleCompositionSettingsSave}
          onCancel={() => setCompositionSettingsTargetId(null)}
        />
      );
    })()}
    {createCompFromFootageTarget && (
      <CreateCompFromFootageDialog
        footage={createCompFromFootageTarget}
        onConfirm={() => {
          createCompositionFromFootage(createCompFromFootageTarget);
          setCreateCompFromFootageTarget(null);
        }}
        onCancel={() => setCreateCompFromFootageTarget(null)}
      />
    )}
    </>
  );
}
