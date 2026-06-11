import { useEffect, useMemo, type RefObject } from "react";
import type { MediaInfo } from "../../shared/types";
import type { FfmpegResolveResult, Job } from "../../shared/types";
import type { CropRect } from "../../shared/clipEdit";
import type { ExportSettings } from "../../shared/projectDocument";
import type { LayerTransform } from "../../shared/transform";
import type { LayerEffectType } from "../../shared/effects";
import type { SaveStatus } from "../hooks/useProjectDocument";
import type { KeyframeInterpolation, TransformGroupKey } from "../../keyframes/keyframeTypes";
import type { SelectedKeyframeRef } from "../../keyframes/keyframeSelection";
import type { ImportSource, ProjectItem, TimelineLayer } from "../../shared/project";
import KeyframeContextMenu, { type KeyframeContextMenuState } from "./KeyframeContextMenu";
import TopBar from "./TopBar";
import PreviewErrorBoundary from "./PreviewErrorBoundary";
import EnginePreviewPanel from "./preview-engine/EnginePreviewPanel";
import type { VideoPreviewHandle } from "./videoPreviewHandle";
import LeftDock, { type LeftDockTab } from "./LeftDock";
import RightDock, { type RightDockTab } from "./RightDock";
import type { TimelineRevealState } from "../utils/timelinePropertyReveal";
import type { PreviewCacheState } from "../../shared/previewCache";
import type { PreviewBufferState } from "../../shared/previewBufferedRanges";
import type { LayerEffect } from "../../shared/effects";
import type { TimelineViewMode } from "../utils/timelineZoom";
import type { EditorTool } from "../../tools/toolTypes";
import type { useMediaVisualCache } from "../hooks/useMediaVisualCache";
import BottomDock, { type BottomTab } from "./BottomDock";
import ToolsToolbar from "./ToolsToolbar";
import SettingsPanel from "./SettingsPanel";
import ShortcutsPanel from "./ShortcutsPanel";
import type { CompositionRenderRange } from "../../ffmpeg/compositionRenderBuilder";
import type { RenderRange } from "../../shared/projectDocument";
import type { PlaybackDiagnostics } from "../types/playbackDiagnostics";
import { extractDroppedPaths, preventDragDefaults } from "../utils/dnd";
import { logPreviewProps } from "../utils/timelineSeekDebug";

export type { BottomTab };

type StudioLayoutProps = {
  videoPreviewRef: RefObject<VideoPreviewHandle>;
  ffmpegStatus: FfmpegResolveResult | null;
  isRunning: boolean;
  canRender: boolean;
  jobs: Job[];
  selectedJobId: string | null;
  projectItems: ProjectItem[];
  selectedProjectItemId: string | null;
  selectedProjectItemIds: string[];
  timelineLayers: TimelineLayer[];
  selectedLayerId: string | null;
  selectedLayer: TimelineLayer | null;
  activeCompositionName: string | null;
  activeCompositionId: string | null;
  onSwitchComposition: (compositionId: string) => void;
  onNewComposition: () => void;
  onCompositionSettings: (compositionId: string) => void;
  onDuplicateComposition: (compositionId: string) => void;
  onDeleteComposition: (compositionId: string) => void;
  onRenameComposition: (compositionId: string) => void;
  onOpenComposition: (compositionId: string) => void;
  onOpenPrecompLayer: (compositionId: string) => void;
  compBreadcrumbs: { id: string; name: string }[];
  canNavigateCompBack: boolean;
  onNavigateCompositionBreadcrumb: (compositionId: string) => void;
  onNavigateCompBack: () => void;
  getLayersForComposition: (compositionId: string) => import("../../shared/project").TimelineLayer[];
  compositionDuration: number;
  compWidth: number;
  compHeight: number;
  fps: number;
  sourceDurations: Record<string, number>;
  importError: string | null;
  previewPathBySourcePath: Record<string, string>;
  footageBySourcePath: Record<string, import("../../shared/project").ProjectItem>;
  previewErrorsByPath: Record<string, string>;
  proxyGeneratingIds: Set<string>;
  onCreatePreviewProxy: (itemId: string) => void;
  onRetryChromiumPreview?: (itemId: string) => void;
  onPreviewError: (sourcePath: string, message: string) => void;
  compCurrentTime: number;
  exportSettings: ExportSettings;
  commandPreview: string;
  commandPreviewNote: string;
  logLines: string[];
  bottomTab: BottomTab;
  settingsOpen: boolean;
  seekTime: number | null;
  isPlaying: boolean;
  playbackRate: number;
  loopPlayback: boolean;
  videoSize: { width: number; height: number };
  onBottomTabChange: (tab: BottomTab) => void;
  onSelectJob: (jobId: string) => void;
  onSelectProjectItem: (
    itemId: string,
    modifiers: import("./ProjectPanel").ProjectItemSelectModifiers
  ) => void;
  onBatchApplyPreset?: () => void;
  onBatchCreateProxies?: () => void;
  onBatchAddToQueue?: () => void;
  onBatchApply?: (options: import("./BatchApplyRecipeDialog").BatchApplyOptions) => void;
  selectedFootageItems?: ProjectItem[];
  onSelectLayer: (
    layerId: string,
    modifiers?: { ctrlKey?: boolean; shiftKey?: boolean }
  ) => void;
  onLayerChange: (layerId: string, patch: Partial<TimelineLayer>) => void;
  onTransformChange: (patch: Partial<LayerTransform>) => void;
  leftDockTab: LeftDockTab;
  onLeftDockTabChange: (tab: LeftDockTab) => void;
  rightDockTab: RightDockTab;
  onRightDockTabChange: (tab: RightDockTab) => void;
  timelineRevealState: TimelineRevealState;
  playbackDiagnostics: PlaybackDiagnostics;
  onPlaybackDiagnostics: (diagnostics: PlaybackDiagnostics) => void;
  onClearTimelineReveal: () => void;
  previewCache: PreviewCacheState;
  previewBufferState: PreviewBufferState;
  onPreviewBufferStateChange: (state: PreviewBufferState) => void;
  useCachedPreview: boolean;
  onCachePreview: () => void;
  onClearPreviewCache: () => void;
  cachePreviewBusy: boolean;
  onLayerEffectsChange: (layerId: string, effects: LayerEffect[]) => void;
  onSelectedLayerToggleEffectParamAnimation: (effectId: string, param: string) => void;
  onSelectedLayerToggleEffectParamDiamond: (effectId: string, param: string) => void;
  onSelectedLayerEffectParamChange: (
    effectId: string,
    param: string,
    value: import("../../shared/effects").LayerEffectParamValue
  ) => void;
  timelineViewMode: TimelineViewMode;
  onLayerTransformChange: (layerId: string, patch: Partial<LayerTransform>) => void;
  onLayerToggleTransformAnimation: (layerId: string, group: TransformGroupKey) => void;
  onLayerToggleKeyframeDiamond: (layerId: string, group: TransformGroupKey) => void;
  onLayerToggleEffectParamAnimation: (layerId: string, effectId: string, param: string) => void;
  onLayerToggleEffectParamDiamond: (layerId: string, effectId: string, param: string) => void;
  onLayerEffectParamChange: (layerId: string, effectId: string, param: string, value: number) => void;
  onTimelineViewModeChange: (mode: TimelineViewMode) => void;
  onAddEffect: (type: LayerEffectType) => void;
  onApplyRecipe: (recipeId: string, options?: { strength?: string }) => void;
  onImportMedia: () => void;
  onImportPaths: (paths: string[], source: ImportSource) => void;
  onRender: () => void;
  onRemoveJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  backgroundTaskSummary: string;
  onVidstabAnalyze: (layerId: string, effect: LayerEffect) => void;
  analysisBusyEffectId?: string | null;
  onOpenOutput: (path: string) => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onSettingsSaved: () => void;
  previewBackend?: import("../../shared/types").PreviewBackendSetting;
  onCropChange: (crop: CropRect) => void;
  onApplyCrop?: () => void;
  onCancelCrop?: () => void;
  onResetCrop?: () => void;
  onCompCurrentTimeChange: (time: number) => void;
  onExportSettingsChange: (patch: Partial<ExportSettings>) => void;
  onSeek: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onPlaybackRateChange: (rate: number) => void;
  onToggleLoop: () => void;
  projectName: string;
  projectPath: string | null;
  isDirty: boolean;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onLayerDragStart: () => void;
  onLayerDragEnd: () => void;
  onRelinkMedia: (itemId: string) => void;
  workAreaStart: number;
  workAreaEnd: number;
  renderRange: RenderRange;
  resolvedRenderRange: CompositionRenderRange;
  compositionOutputPath: string;
  onRenderRangeChange: (range: RenderRange) => void;
  statusMessage: string | null;
  shortcutsOpen: boolean;
  onCloseShortcuts: () => void;
  onStatusHint?: (message: string) => void;
  activeTool: EditorTool;
  onActiveToolChange: (tool: EditorTool) => void;
  isSpacePanActive?: boolean;
  onSpacePanOccurred?: () => void;
  onSplitLayer: (layerId: string, splitTime: number) => void;
  selectedKeyframes: SelectedKeyframeRef[];
  onSelectKeyframe: (selection: SelectedKeyframeRef, options?: { additive?: boolean }) => void;
  onClearKeyframeSelection: () => void;
  onMoveKeyframe: (
    layerId: string,
    property: import("../../keyframes/keyframeTypes").TransformPropertyKey,
    keyframeId: string,
    newTime: number
  ) => void;
  onKeyframeDragStart: () => void;
  onKeyframeDragEnd: () => void;
  onSetKeyframeInterpolation: (interpolation: KeyframeInterpolation) => void;
  onMoveEffectKeyframe: (
    layerId: string,
    effectId: string,
    param: string,
    keyframeId: string,
    newTime: number
  ) => void;
  onOpenKeyframeContextMenu: (state: NonNullable<KeyframeContextMenuState>) => void;
  keyframeContextMenu: KeyframeContextMenuState;
  onCloseKeyframeContextMenu: () => void;
  onKeyframeContextDelete: () => void;
  onKeyframeContextCopy: () => void;
  mediaCache: Pick<
    ReturnType<typeof useMediaVisualCache>,
    "getThumbnailEntry" | "requestThumbnails" | "getWaveformEntry" | "requestWaveform"
  >;
};

export default function StudioLayout(props: StudioLayoutProps) {
  const {
    videoPreviewRef,
    ffmpegStatus,
    isRunning,
    canRender,
    jobs,
    selectedJobId,
    projectItems,
    selectedProjectItemId,
    selectedProjectItemIds,
    timelineLayers,
    selectedLayerId,
    selectedLayer,
    activeCompositionName,
    activeCompositionId,
    onSwitchComposition,
    onNewComposition,
    onCompositionSettings,
    onDuplicateComposition,
    onDeleteComposition,
    onRenameComposition,
    onOpenComposition,
    onOpenPrecompLayer,
    compBreadcrumbs: _compBreadcrumbs,
    canNavigateCompBack: _canNavigateCompBack,
    onNavigateCompositionBreadcrumb: _onNavigateCompositionBreadcrumb,
    onNavigateCompBack: _onNavigateCompBack,
    getLayersForComposition: _getLayersForComposition,
    compositionDuration,
    compWidth,
    compHeight,
    fps,
    sourceDurations,
    importError,
    previewPathBySourcePath,
    footageBySourcePath,
    proxyGeneratingIds,
    onCreatePreviewProxy,
    onRetryChromiumPreview,
    onBatchApplyPreset,
    onBatchCreateProxies,
    onBatchAddToQueue,
    onBatchApply,
    selectedFootageItems = [],
    compCurrentTime,
    exportSettings,
    commandPreview,
    commandPreviewNote,
    logLines,
    bottomTab,
    settingsOpen,
    seekTime,
    isPlaying,
    playbackRate,
    loopPlayback,
    onBottomTabChange,
    onSelectJob,
    onSelectProjectItem,
    onSelectLayer,
    onLayerChange,
    onTransformChange: _onTransformChange,
    onCropChange: _onCropChange,
    leftDockTab,
    onLeftDockTabChange,
    rightDockTab,
    onRightDockTabChange,
    timelineRevealState,
    playbackDiagnostics,
    onClearTimelineReveal,
    previewCache,
    previewBufferState,
    onPreviewBufferStateChange,
    onLayerEffectsChange,
    onSelectedLayerToggleEffectParamAnimation,
    onSelectedLayerToggleEffectParamDiamond,
    onSelectedLayerEffectParamChange,
    timelineViewMode,
    onLayerTransformChange,
    onLayerToggleTransformAnimation,
    onLayerToggleKeyframeDiamond,
    onLayerToggleEffectParamAnimation,
    onLayerToggleEffectParamDiamond,
    onLayerEffectParamChange,
    onTimelineViewModeChange,
    onAddEffect,
    onApplyRecipe,
    onImportMedia,
    onImportPaths,
    onRender,
    onRemoveJob,
    onCancelJob,
    backgroundTaskSummary,
    onVidstabAnalyze,
    analysisBusyEffectId = null,
    onOpenOutput,
    onOpenSettings,
    onCloseSettings,
    onSettingsSaved,
    previewBackend: _previewBackend = "chromium-video",
    onApplyCrop,
    onCancelCrop,
    onResetCrop,
    onCompCurrentTimeChange,
    onExportSettingsChange,
    onSeek,
    onPlayingChange,
    onPlaybackRateChange,
    onToggleLoop,
    projectName,
    isDirty,
    saveStatus,
    onLayerDragStart,
    onLayerDragEnd,
    onRelinkMedia,
    workAreaStart,
    workAreaEnd,
    renderRange,
    resolvedRenderRange,
    compositionOutputPath,
    onRenderRangeChange,
    statusMessage,
    shortcutsOpen,
    onCloseShortcuts,
    onStatusHint,
    activeTool,
    onActiveToolChange,
    isSpacePanActive = false,
    onSpacePanOccurred,
    onSplitLayer,
    selectedKeyframes,
    onSelectKeyframe,
    onClearKeyframeSelection,
    onMoveKeyframe,
    onKeyframeDragStart,
    onKeyframeDragEnd,
    onSetKeyframeInterpolation,
    onMoveEffectKeyframe,
    onOpenKeyframeContextMenu,
    keyframeContextMenu,
    onCloseKeyframeContextMenu,
    onKeyframeContextDelete,
    onKeyframeContextCopy,
    mediaCache,
  } = props;

  useEffect(() => {
    logPreviewProps(seekTime, compCurrentTime);
  }, [seekTime, compCurrentTime]);

  const selectedFootage =
    projectItems.find((item) => item.type === "footage" && item.id === selectedProjectItemId) ??
    (() => {
      if (!selectedLayer) {
        return projectItems.find((item) => item.type === "footage") ?? null;
      }
      return (
        projectItems.find(
          (item) => item.type === "footage" && item.path === selectedLayer.sourcePath
        ) ?? null
      );
    })();

  const selectedInputPath = selectedFootage?.path ?? null;
  const duration = compositionDuration || selectedFootage?.mediaInfo?.durationSeconds || 0;

  const handleWindowDrop = (event: React.DragEvent) => {
    preventDragDefaults(event);
    const paths = extractDroppedPaths(event);
    if (paths.length > 0) {
      onImportPaths(paths, "window-drop");
    }
  };

  const handleProjectItemDoubleClick = (itemId: string) => {
    const item = projectItems.find((entry) => entry.id === itemId);
    if (item?.type === "composition") {
      onOpenComposition(itemId);
    }
  };

  const mediaInfoByPath = useMemo(() => {
    const map: Record<string, MediaInfo | undefined> = {};
    for (const item of projectItems) {
      if (item.type === "footage" && item.path) {
        map[item.path] = item.mediaInfo;
      }
    }
    return map;
  }, [projectItems]);

  return (
    <div
      className="studio"
      onDragOver={preventDragDefaults}
      onDrop={handleWindowDrop}
    >
      <TopBar
        ffmpegStatus={ffmpegStatus}
        isRunning={isRunning}
        canStart={canRender}
        projectName={projectName}
        isDirty={isDirty}
        saveStatus={saveStatus}
        onAddMedia={onImportMedia}
        onStartQueue={onRender}
        onOpenSettings={onOpenSettings}
        renderLabel="Render"
        taskSummary={backgroundTaskSummary}
        canCancelTask={isRunning}
        onCancelTask={() => {
          const running = jobs.find((job) => job.status === "running");
          if (running) {
            onCancelJob(running.id);
          }
        }}
        statusMessage={statusMessage}
      />

      <ToolsToolbar
        activeTool={activeTool}
        isSpacePanActive={isSpacePanActive}
        onToolChange={onActiveToolChange}
        onApplyCrop={onApplyCrop}
        onCancelCrop={onCancelCrop}
        onResetCrop={onResetCrop}
      />

      <div className="studio-workspace-row">
        <LeftDock
          activeTab={leftDockTab}
          onTabChange={onLeftDockTabChange}
          projectItems={projectItems}
          selectedProjectItemId={selectedProjectItemId}
          selectedProjectItemIds={selectedProjectItemIds}
          importError={importError}
          proxyGeneratingIds={proxyGeneratingIds}
          onImportMedia={onImportMedia}
          onSelectProjectItem={onSelectProjectItem}
          onProjectItemDoubleClick={handleProjectItemDoubleClick}
          activeCompositionId={activeCompositionId}
          onNewComposition={onNewComposition}
          onCompositionSettings={onCompositionSettings}
          onDuplicateComposition={onDuplicateComposition}
          onDeleteComposition={onDeleteComposition}
          onRenameComposition={onRenameComposition}
          onOpenComposition={onOpenComposition}
          onDropPaths={onImportPaths}
          onRelinkMedia={onRelinkMedia}
          onCreatePreviewProxy={onCreatePreviewProxy}
          onRetryChromiumPreview={onRetryChromiumPreview}
          onBatchApplyPreset={onBatchApplyPreset}
          onBatchCreateProxies={onBatchCreateProxies}
          onBatchAddToQueue={onBatchAddToQueue}
          selectedLayer={selectedLayer}
          compCurrentTime={compCurrentTime}
          selectedKeyframes={selectedKeyframes}
          onToggleEffectParamAnimation={onSelectedLayerToggleEffectParamAnimation}
          onToggleEffectParamDiamond={onSelectedLayerToggleEffectParamDiamond}
          onEffectParamChange={onSelectedLayerEffectParamChange}
          onEffectsChange={onLayerEffectsChange}
          onVidstabAnalyze={onVidstabAnalyze}
          analysisBusyEffectId={analysisBusyEffectId}
        />

        <PreviewErrorBoundary>
          <EnginePreviewPanel
            ref={videoPreviewRef}
            timelineLayers={timelineLayers}
            projectItems={projectItems}
            mediaInfoByPath={mediaInfoByPath}
            compositionName={activeCompositionName}
            compWidth={compWidth}
            compHeight={compHeight}
            selectedLayer={selectedLayer}
            compCurrentTime={compCurrentTime}
            compDuration={duration}
            playbackRate={playbackRate}
            loop={loopPlayback}
            seekTime={seekTime}
            onAddMedia={onImportMedia}
            isPlaying={isPlaying}
            onCurrentTimeChange={onCompCurrentTimeChange}
            onPlayingChange={onPlayingChange}
            onPlaybackRateChange={onPlaybackRateChange}
            onToggleLoop={onToggleLoop}
            onPreviewBufferStateChange={onPreviewBufferStateChange}
          />
        </PreviewErrorBoundary>

        <RightDock
          activeTab={rightDockTab}
          onTabChange={onRightDockTabChange}
          selectedLayer={selectedLayer}
          timelineLayers={timelineLayers}
          inputPath={selectedInputPath}
          selectedFootageItem={selectedFootage}
          selectedProjectItem={
            projectItems.find((item) => item.id === selectedProjectItemId) ?? null
          }
          proxyGeneratingIds={proxyGeneratingIds}
          onCreatePreviewProxy={onCreatePreviewProxy}
          selectedFootageItems={selectedFootageItems}
          ffmpegChecking={ffmpegStatus === null}
          ffmpegError={ffmpegStatus && !ffmpegStatus.ok ? ffmpegStatus.error : null}
          exportSettings={exportSettings}
          mediaInfo={selectedFootage?.mediaInfo}
          compWidth={compWidth}
          compHeight={compHeight}
          compositionName={activeCompositionName}
          workAreaStart={workAreaStart}
          workAreaEnd={workAreaEnd}
          renderRange={renderRange}
          resolvedRenderRange={resolvedRenderRange}
          compositionOutputPath={compositionOutputPath}
          canRender={canRender}
          isRunning={isRunning}
          onAddEffect={onAddEffect}
          onApplyRecipe={onApplyRecipe}
          onHint={onStatusHint}
          onRenderRangeChange={onRenderRangeChange}
          onExportSettingsChange={onExportSettingsChange}
          onRender={onRender}
          onBatchApply={onBatchApply}
          timelineRevealState={timelineRevealState}
          timelineViewMode={timelineViewMode}
          activeTool={activeTool}
          compCurrentTime={compCurrentTime}
          playbackDiagnostics={playbackDiagnostics}
          previewPathBySourcePath={previewPathBySourcePath}
          jobs={jobs}
          isPlaying={isPlaying}
        />
      </div>

      <BottomDock
        activeTab={bottomTab}
        onTabChange={onBottomTabChange}
        compositions={projectItems.filter((item) => item.type === "composition")}
        activeCompositionId={activeCompositionId}
        onSwitchComposition={onSwitchComposition}
        duration={duration}
        compCurrentTime={compCurrentTime}
        workAreaStart={workAreaStart}
        workAreaEnd={workAreaEnd}
        fps={fps}
        layers={timelineLayers}
        selectedLayerId={selectedLayerId}
        sourceDurations={sourceDurations}
        onSeek={onSeek}
        onSelectLayer={onSelectLayer}
        onOpenPrecompLayer={onOpenPrecompLayer}
        onLayerChange={onLayerChange}
        timelineViewMode={timelineViewMode}
        onLayerTransformChange={onLayerTransformChange}
        onLayerToggleTransformAnimation={onLayerToggleTransformAnimation}
        onLayerToggleKeyframeDiamond={onLayerToggleKeyframeDiamond}
        onLayerToggleEffectParamAnimation={onLayerToggleEffectParamAnimation}
        onLayerToggleEffectParamDiamond={onLayerToggleEffectParamDiamond}
        onLayerEffectParamChange={onLayerEffectParamChange}
        onTimelineViewModeChange={onTimelineViewModeChange}
        renderRange={renderRange}
        resolvedRenderRange={resolvedRenderRange}
        activeTool={activeTool}
        isSpacePanActive={isSpacePanActive}
        onSpacePanOccurred={onSpacePanOccurred}
        onSplitLayer={onSplitLayer}
        selectedKeyframes={selectedKeyframes}
        onSelectKeyframe={onSelectKeyframe}
        onClearKeyframeSelection={onClearKeyframeSelection}
        onMoveKeyframe={onMoveKeyframe}
        onMoveEffectKeyframe={onMoveEffectKeyframe}
        onKeyframeDragStart={onKeyframeDragStart}
        onKeyframeDragEnd={onKeyframeDragEnd}
        onOpenKeyframeContextMenu={onOpenKeyframeContextMenu}
        mediaCache={mediaCache}
        previewPathBySourcePath={previewPathBySourcePath}
        footageBySourcePath={footageBySourcePath}
        compWidth={compWidth}
        compHeight={compHeight}
        timelineRevealState={timelineRevealState}
        onClearTimelineReveal={onClearTimelineReveal}
        previewCache={previewCache}
        previewBufferState={previewBufferState}
        onLayerDragStart={onLayerDragStart}
        onLayerDragEnd={onLayerDragEnd}
        onImportPaths={onImportPaths}
        jobs={jobs}
        selectedJobId={selectedJobId}
        onSelectJob={onSelectJob}
        onRemove={onRemoveJob}
        onCancelJob={onCancelJob}
        onOpenOutput={onOpenOutput}
        commandPreview={commandPreview}
        commandPreviewNote={commandPreviewNote}
        logLines={logLines}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={onCloseSettings}
        onSaved={onSettingsSaved}
      />

      <ShortcutsPanel open={shortcutsOpen} onClose={onCloseShortcuts} />

      <KeyframeContextMenu
        menu={keyframeContextMenu}
        onClose={onCloseKeyframeContextMenu}
        onSetInterpolation={onSetKeyframeInterpolation}
        onDelete={onKeyframeContextDelete}
        onCopy={onKeyframeContextCopy}
      />
    </div>
  );
}
