import type { TransformGroupKey, TransformPropertyKey } from "../../keyframes/keyframeTypes";
import type { LayerTransform } from "../../shared/transform";
import type { SelectedKeyframeRef } from "../../keyframes/keyframeSelection";
import type { ImportSource, ProjectItem, TimelineLayer } from "../../shared/project";
import { migrateCompositionName } from "../../shared/compRuntime";
import type { KeyframeContextMenuState } from "./KeyframeContextMenu";
import type { Job } from "../../shared/types";
import type { CompositionRenderRange } from "../../ffmpeg/compositionRenderBuilder";
import type { RenderRange } from "../../shared/projectDocument";
import type { EditorTool } from "../../tools/toolTypes";
import type { useMediaVisualCache } from "../hooks/useMediaVisualCache";
import type { TimelineViewMode } from "../utils/timelineZoom";
import {
  NORMAL_TIMELINE_REVEAL,
  type TimelineRevealState,
} from "../utils/timelinePropertyReveal";
import type { PreviewCacheState } from "../../shared/previewCache";
import type { PreviewBufferState } from "../../shared/previewBufferedRanges";
import TimelineEditor from "./TimelineEditor";
import BackgroundTasksPanel from "./BackgroundTasksPanel";
import JobDetailPanel from "./JobDetailPanel";
import CommandPreview from "./CommandPreview";
import LogPanel from "./LogPanel";

export type BottomTab = "comp" | "tasks" | "command" | "logs";

type BottomDockProps = {
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
  compositions: ProjectItem[];
  activeCompositionId: string | null;
  onSwitchComposition: (compositionId: string) => void;
  duration: number;
  compCurrentTime: number;
  workAreaStart?: number;
  workAreaEnd?: number;
  fps: number;
  layers: TimelineLayer[];
  selectedLayerId: string | null;
  sourceDurations: Record<string, number>;
  onSeek: (time: number) => void;
  onSelectLayer: (
    layerId: string,
    modifiers?: { ctrlKey?: boolean; shiftKey?: boolean }
  ) => void;
  onOpenPrecompLayer?: (compositionId: string) => void;
  onLayerChange: (layerId: string, patch: Partial<TimelineLayer>) => void;
  onLayerDragStart?: () => void;
  onLayerTransformChange?: (layerId: string, patch: Partial<LayerTransform>) => void;
  onLayerToggleTransformAnimation?: (layerId: string, group: TransformGroupKey) => void;
  onLayerToggleKeyframeDiamond?: (layerId: string, group: TransformGroupKey) => void;
  onLayerToggleEffectParamAnimation?: (layerId: string, effectId: string, param: string) => void;
  onLayerToggleEffectParamDiamond?: (layerId: string, effectId: string, param: string) => void;
  onLayerEffectParamChange?: (layerId: string, effectId: string, param: string, value: number) => void;
  onLayerDragEnd?: () => void;
  timelineViewMode: TimelineViewMode;
  onTimelineViewModeChange: (mode: TimelineViewMode) => void;
  renderRange: RenderRange;
  resolvedRenderRange: CompositionRenderRange;
  activeTool: EditorTool;
  isSpacePanActive?: boolean;
  onSpacePanOccurred?: () => void;
  onSplitLayer: (layerId: string, splitTime: number) => void;
  selectedKeyframes?: SelectedKeyframeRef[];
  onSelectKeyframe?: (selection: SelectedKeyframeRef, options?: { additive?: boolean }) => void;
  onClearKeyframeSelection?: () => void;
  onMoveKeyframe?: (
    layerId: string,
    property: TransformPropertyKey,
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
  mediaCache: Pick<
    ReturnType<typeof useMediaVisualCache>,
    "getThumbnailEntry" | "requestThumbnails" | "getWaveformEntry" | "requestWaveform"
  >;
  previewPathBySourcePath: Record<string, string>;
  footageBySourcePath?: Record<string, import("../../shared/project").ProjectItem>;
  compWidth?: number;
  compHeight?: number;
  timelineRevealState?: TimelineRevealState;
  onClearTimelineReveal?: () => void;
  previewCache?: PreviewCacheState;
  previewBufferState?: PreviewBufferState;
  onImportPaths: (paths: string[], source: ImportSource) => void;
  jobs: Job[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onRemove: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onOpenOutput: (outputPath: string) => void;
  commandPreview: string;
  commandPreviewNote: string;
  logLines: string[];
  onClearLogs?: () => void;
};

export default function BottomDock({
  activeTab,
  onTabChange,
  compositions,
  activeCompositionId,
  onSwitchComposition,
  duration,
  compCurrentTime,
  workAreaStart,
  workAreaEnd,
  fps,
  layers,
  selectedLayerId,
  sourceDurations,
  onSeek,
  onSelectLayer,
  onOpenPrecompLayer,
  onLayerChange,
  onLayerDragStart,
  onLayerTransformChange,
  onLayerToggleTransformAnimation,
  onLayerToggleKeyframeDiamond,
  onLayerToggleEffectParamAnimation,
  onLayerToggleEffectParamDiamond,
  onLayerEffectParamChange,
  onLayerDragEnd,
  timelineViewMode,
  onTimelineViewModeChange,
  renderRange,
  resolvedRenderRange,
  activeTool,
  isSpacePanActive = false,
  onSpacePanOccurred,
  onSplitLayer,
  selectedKeyframes,
  onSelectKeyframe,
  onClearKeyframeSelection,
  onMoveKeyframe,
  onMoveEffectKeyframe,
  onKeyframeDragStart,
  onKeyframeDragEnd,
  onOpenKeyframeContextMenu,
  mediaCache,
  previewPathBySourcePath,
  footageBySourcePath = {},
  compWidth,
  compHeight,
  timelineRevealState = NORMAL_TIMELINE_REVEAL,
  onClearTimelineReveal,
  previewCache,
  previewBufferState,
  onImportPaths,
  jobs,
  selectedJobId,
  onSelectJob,
  onRemove,
  onCancelJob,
  onOpenOutput,
  commandPreview,
  commandPreviewNote,
  logLines,
  onClearLogs,
}: BottomDockProps) {
  const compositionTabs = compositions.filter((item) => item.type === "composition");
  const showTimeline = Boolean(activeCompositionId);

  const utilityTabs: { id: BottomTab; label: string }[] = [
    { id: "tasks", label: "Tasks" },
    { id: "command", label: "Command Preview" },
    { id: "logs", label: "Logs" },
  ];

  return (
    <section className="bottom-dock">
      <div className="bottom-dock-tabs">
        <div className="bottom-dock-comp-tabs">
          {compositionTabs.map((comp) => (
            <button
              key={comp.id}
              type="button"
              className={`bottom-dock-tab bottom-dock-comp-tab ${
                activeTab === "comp" && activeCompositionId === comp.id ? "active" : ""
              }`}
              onClick={() => {
                onSwitchComposition(comp.id);
                onTabChange("comp");
              }}
            >
              {migrateCompositionName(comp.name)}
            </button>
          ))}
        </div>
        <div className="bottom-dock-utility-tabs">
          {utilityTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`bottom-dock-tab bottom-dock-utility-tab ${
                activeTab === tab.id ? "active" : ""
              }`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bottom-dock-content">
        {activeTab === "comp" &&
          (showTimeline ? (
            <TimelineEditor
              embedded
              duration={duration}
              layers={layers}
              selectedLayerId={selectedLayerId}
              compCurrentTime={compCurrentTime}
              workAreaStart={workAreaStart}
              workAreaEnd={workAreaEnd}
              fps={fps}
              sourceDurations={sourceDurations}
              onSeek={onSeek}
              onSelectLayer={onSelectLayer}
              onOpenPrecompLayer={onOpenPrecompLayer}
              onLayerChange={onLayerChange}
              onLayerDragStart={onLayerDragStart}
              onTransformChange={onLayerTransformChange}
              onToggleTransformAnimation={onLayerToggleTransformAnimation}
              onToggleKeyframeDiamond={onLayerToggleKeyframeDiamond}
              onToggleEffectParamAnimation={onLayerToggleEffectParamAnimation}
              onToggleEffectParamDiamond={onLayerToggleEffectParamDiamond}
              onEffectParamChange={onLayerEffectParamChange}
              onLayerDragEnd={onLayerDragEnd}
              viewMode={timelineViewMode}
              onViewModeChange={onTimelineViewModeChange}
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
              onDropPaths={(paths) => onImportPaths(paths, "timeline-drop")}
            />
          ) : (
            <div className="bottom-dock-empty">
              Import footage or drop video files to open the composition timeline.
            </div>
          ))}

        {activeTab === "tasks" && (
          <div className="background-tasks-layout">
            <BackgroundTasksPanel
              jobs={jobs}
              selectedJobId={selectedJobId}
              onSelectJob={onSelectJob}
              onCancelJob={onCancelJob}
              onRemoveJob={onRemove}
              onOpenOutput={onOpenOutput}
            />
            <JobDetailPanel
              job={jobs.find((job) => job.id === selectedJobId) ?? null}
              onOpenOutput={onOpenOutput}
            />
          </div>
        )}

        {activeTab === "command" && (
          <CommandPreview command={commandPreview} note={commandPreviewNote} />
        )}
        {activeTab === "logs" && <LogPanel lines={logLines} onClear={onClearLogs} />}
      </div>
    </section>
  );
}
