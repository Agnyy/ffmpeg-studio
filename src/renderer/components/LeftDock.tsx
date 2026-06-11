import type { ImportSource, ProjectItem, TimelineLayer } from "../../shared/project";
import type { SelectedKeyframeRef } from "../../keyframes/keyframeSelection";
import type { LayerEffect } from "../../shared/effects";
import ProjectPanel, { type ProjectItemSelectModifiers } from "./ProjectPanel";
import EffectControlsDockPanel from "./EffectControlsDockPanel";

export type LeftDockTab = "project" | "effectControls";

type LeftDockProps = {
  activeTab: LeftDockTab;
  onTabChange: (tab: LeftDockTab) => void;
  projectItems: ProjectItem[];
  selectedProjectItemId: string | null;
  selectedProjectItemIds: string[];
  importError: string | null;
  proxyGeneratingIds: Set<string>;
  onImportMedia: () => void;
  onSelectProjectItem: (itemId: string, modifiers: ProjectItemSelectModifiers) => void;
  onBatchApplyPreset?: () => void;
  onBatchCreateProxies?: () => void;
  onBatchAddToQueue?: () => void;
  onProjectItemDoubleClick?: (itemId: string) => void;
  activeCompositionId?: string | null;
  onNewComposition?: () => void;
  onCompositionSettings?: (itemId: string) => void;
  onDuplicateComposition?: (itemId: string) => void;
  onDeleteComposition?: (itemId: string) => void;
  onRenameComposition?: (itemId: string) => void;
  onOpenComposition?: (itemId: string) => void;
  onDropPaths: (paths: string[], source: ImportSource) => void;
  onRelinkMedia: (itemId: string) => void;
  onCreatePreviewProxy: (itemId: string) => void;
  onRetryChromiumPreview?: (itemId: string) => void;
  selectedLayer: TimelineLayer | null;
  compCurrentTime: number;
  selectedKeyframes: SelectedKeyframeRef[];
  onToggleEffectParamAnimation: (effectId: string, param: string) => void;
  onToggleEffectParamDiamond: (effectId: string, param: string) => void;
  onEffectParamChange: (
    effectId: string,
    param: string,
    value: import("../../shared/effects").LayerEffectParamValue
  ) => void;
  onEffectsChange: (layerId: string, effects: LayerEffect[]) => void;
  onVidstabAnalyze?: (layerId: string, effect: LayerEffect) => void;
  analysisBusyEffectId?: string | null;
};

export default function LeftDock({
  activeTab,
  onTabChange,
  projectItems,
  selectedProjectItemId,
  selectedProjectItemIds,
  importError,
  proxyGeneratingIds,
  onImportMedia,
  onSelectProjectItem,
  onProjectItemDoubleClick,
  activeCompositionId = null,
  onNewComposition,
  onCompositionSettings,
  onDuplicateComposition,
  onDeleteComposition,
  onRenameComposition,
  onOpenComposition,
  onDropPaths,
  onRelinkMedia,
  onCreatePreviewProxy,
  onRetryChromiumPreview,
  onBatchApplyPreset,
  onBatchCreateProxies,
  onBatchAddToQueue,
  selectedLayer,
  compCurrentTime,
  selectedKeyframes,
  onToggleEffectParamAnimation,
  onToggleEffectParamDiamond,
  onEffectParamChange,
  onEffectsChange,
  onVidstabAnalyze,
  analysisBusyEffectId = null,
}: LeftDockProps) {
  const tabs: { id: LeftDockTab; label: string }[] = [
    { id: "project", label: "Project" },
    { id: "effectControls", label: "Effect Controls" },
  ];

  return (
    <aside className="left-dock">
      <div className="left-dock-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`left-dock-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="left-dock-body">
        {activeTab === "project" ? (
          <ProjectPanel
            embedded
            items={projectItems}
            selectedItemId={selectedProjectItemId}
            selectedItemIds={selectedProjectItemIds}
            activeCompositionId={activeCompositionId}
            importError={importError}
            proxyGeneratingIds={proxyGeneratingIds}
            onImportMedia={onImportMedia}
            onNewComposition={onNewComposition}
            onCompositionSettings={onCompositionSettings}
            onDuplicateComposition={onDuplicateComposition}
            onDeleteComposition={onDeleteComposition}
            onRenameComposition={onRenameComposition}
            onOpenComposition={onOpenComposition}
            onSelectItem={onSelectProjectItem}
            onItemDoubleClick={onProjectItemDoubleClick}
            onDropPaths={(paths) => onDropPaths(paths, "project-drop")}
            onRelinkMedia={onRelinkMedia}
            onCreatePreviewProxy={onCreatePreviewProxy}
            onRetryChromiumPreview={onRetryChromiumPreview}
            onBatchApplyPreset={onBatchApplyPreset}
            onBatchCreateProxies={onBatchCreateProxies}
            onBatchAddToQueue={onBatchAddToQueue}
          />
        ) : (
          <EffectControlsDockPanel
            selectedLayer={selectedLayer}
            compCurrentTime={compCurrentTime}
            selectedKeyframes={selectedKeyframes}
            onToggleEffectParamAnimation={onToggleEffectParamAnimation}
            onToggleEffectParamDiamond={onToggleEffectParamDiamond}
            onEffectParamChange={onEffectParamChange}
            onEffectsChange={(effects) => {
              if (selectedLayer) {
                onEffectsChange(selectedLayer.id, effects);
              }
            }}
            onVidstabAnalyze={onVidstabAnalyze}
            analysisBusyEffectId={analysisBusyEffectId}
          />
        )}
      </div>
    </aside>
  );
}
