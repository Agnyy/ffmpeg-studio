import type { ExportSettings } from "../../shared/projectDocument";
import type { LayerEffectType } from "../../shared/effects";
import type { CompositionRenderRange } from "../../ffmpeg/compositionRenderBuilder";
import type { RenderRange } from "../../shared/projectDocument";
import type { ProjectItem, TimelineLayer } from "../../shared/project";
import type { Job, MediaInfo } from "../../shared/types";
import { memo, useEffect } from "react";
import { useRenderCount } from "../hooks/useRenderCount";
import type { EditorTool } from "../../tools/toolTypes";
import type { PlaybackDiagnostics } from "../types/playbackDiagnostics";
import type { TimelineRevealState } from "../utils/timelinePropertyReveal";
import type { TimelineViewMode } from "../utils/timelineZoom";
import EffectsPresetsPanel from "./EffectsPresetsPanel";
import ExportPanel from "./ExportPanel";
import InfoPanel from "./InfoPanel";
import ThumbnailDebugPanel from "./ThumbnailDebugPanel";

const IS_DEV = process.env.NODE_ENV !== "production";

export type RightDockTab = "effects" | "export" | "info" | "thumbDebug";

type RightDockProps = {
  activeTab: RightDockTab;
  onTabChange: (tab: RightDockTab) => void;
  selectedLayer: TimelineLayer | null;
  timelineLayers: TimelineLayer[];
  selectedFootageItem?: ProjectItem | null;
  selectedProjectItem?: ProjectItem | null;
  inputPath: string | null;
  exportSettings: ExportSettings;
  mediaInfo?: MediaInfo;
  compWidth: number;
  compHeight: number;
  compositionName: string | null;
  workAreaStart: number;
  workAreaEnd: number;
  renderRange: RenderRange;
  resolvedRenderRange: CompositionRenderRange;
  compositionOutputPath: string;
  canRender: boolean;
  isRunning: boolean;
  proxyGeneratingIds?: Set<string>;
  onCreatePreviewProxy?: (itemId: string) => void;
  selectedFootageItems?: ProjectItem[];
  ffmpegChecking?: boolean;
  ffmpegError?: string | null;
  onAddEffect: (type: LayerEffectType) => void;
  onApplyRecipe: (recipeId: string, options?: { strength?: string }) => void;
  onHint?: (message: string) => void;
  onRenderRangeChange: (range: RenderRange) => void;
  onExportSettingsChange: (patch: Partial<ExportSettings>) => void;
  onRender: () => void;
  onBatchApply?: (options: import("./BatchApplyRecipeDialog").BatchApplyOptions) => void;
  timelineRevealState?: TimelineRevealState;
  timelineViewMode?: TimelineViewMode;
  activeTool?: EditorTool;
  compCurrentTime?: number;
  playbackDiagnostics?: PlaybackDiagnostics;
  previewPathBySourcePath?: Record<string, string>;
  jobs?: Job[];
  isPlaying?: boolean;
};

function RightDock({
  activeTab,
  onTabChange,
  selectedLayer,
  timelineLayers,
  selectedFootageItem,
  selectedProjectItem,
  inputPath,
  exportSettings,
  mediaInfo,
  compWidth,
  compHeight,
  compositionName,
  workAreaStart,
  workAreaEnd,
  renderRange,
  resolvedRenderRange,
  compositionOutputPath,
  canRender,
  isRunning,
  proxyGeneratingIds,
  onCreatePreviewProxy,
  selectedFootageItems = [],
  ffmpegChecking = false,
  ffmpegError = null,
  onAddEffect,
  onApplyRecipe,
  onHint,
  onRenderRangeChange,
  onExportSettingsChange,
  onRender,
  onBatchApply,
  timelineRevealState,
  timelineViewMode = "layer",
  activeTool = "selection",
  compCurrentTime = 0,
  playbackDiagnostics,
  previewPathBySourcePath = {},
  jobs = [],
  isPlaying = false,
}: RightDockProps) {
  useRenderCount("RightDock");

  useEffect(() => {
    if (!IS_DEV && activeTab === "thumbDebug") {
      onTabChange("effects");
    }
  }, [activeTab, onTabChange]);

  const tabs: { id: RightDockTab; label: string }[] = [
    { id: "effects", label: "Effects & Presets" },
    { id: "export", label: "Export" },
    { id: "info", label: "Info" },
    ...(IS_DEV ? [{ id: "thumbDebug" as const, label: "Thumb Debug" }] : []),
  ];

  return (
    <aside className="right-dock">
      <div className="right-dock-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`right-dock-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="right-dock-body">
        {activeTab === "effects" && (
          <EffectsPresetsPanel
            selectedLayer={selectedLayer}
            ffmpegChecking={ffmpegChecking}
            ffmpegError={ffmpegError}
            onAddEffect={onAddEffect}
            onApplyRecipe={onApplyRecipe}
            onHint={onHint}
          />
        )}
        {activeTab === "info" && (
          <InfoPanel
            selectedLayer={selectedLayer}
            selectedFootageItem={selectedFootageItem ?? null}
            selectedProjectItem={selectedProjectItem ?? null}
            mediaInfo={mediaInfo}
            proxyGeneratingIds={proxyGeneratingIds}
            onCreatePreviewProxy={onCreatePreviewProxy}
            timelineLayers={timelineLayers}
            timelineRevealState={timelineRevealState}
            timelineViewMode={timelineViewMode}
            activeTool={activeTool}
            compWidth={compWidth}
            compHeight={compHeight}
            compCurrentTime={compCurrentTime}
            playbackDiagnostics={playbackDiagnostics}
            renderRange={renderRange}
            resolvedRenderRange={resolvedRenderRange}
            previewPathBySourcePath={previewPathBySourcePath}
            jobs={jobs}
            isPlaying={isPlaying}
          />
        )}
        {activeTab === "thumbDebug" && (
          <ThumbnailDebugPanel footagePath={selectedFootageItem?.path ?? null} />
        )}
        {activeTab === "export" && (
          <ExportPanel
            compositionName={compositionName}
            inputPath={inputPath}
            mediaInfo={mediaInfo}
            selectedLayer={selectedLayer}
            timelineLayers={timelineLayers}
            exportSettings={exportSettings}
            compWidth={compWidth}
            compHeight={compHeight}
            workAreaStart={workAreaStart}
            workAreaEnd={workAreaEnd}
            renderRange={renderRange}
            resolvedRenderRange={resolvedRenderRange}
            outputPath={compositionOutputPath}
            canRender={canRender}
            isRunning={isRunning}
            onRenderRangeChange={onRenderRangeChange}
            selectedFootageItems={selectedFootageItems}
            onExportSettingsChange={onExportSettingsChange}
            onRender={onRender}
            onBatchApply={onBatchApply}
          />
        )}
      </div>
    </aside>
  );
}

export default memo(RightDock);
