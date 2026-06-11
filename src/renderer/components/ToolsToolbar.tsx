import { Crop, MousePointer2, Scissors } from "lucide-react";
import type { EditorTool } from "../../tools/toolTypes";
import { getToolHint, TOOLBAR_TOOLS } from "../../tools/toolState";

type ToolsToolbarProps = {
  activeTool: EditorTool;
  isSpacePanActive?: boolean;
  onToolChange: (tool: EditorTool) => void;
  onApplyCrop?: () => void;
  onCancelCrop?: () => void;
  onResetCrop?: () => void;
};

const TOOL_CONFIG: Record<
  EditorTool,
  { label: string; icon: typeof MousePointer2; hotkey: string } | undefined
> = {
  selection: { label: "Selection", icon: MousePointer2, hotkey: "V" },
  razor: { label: "Razor", icon: Scissors, hotkey: "G" },
  crop: { label: "Crop", icon: Crop, hotkey: "C" },
  hand: undefined,
  transform: undefined,
};

export default function ToolsToolbar({
  activeTool,
  isSpacePanActive = false,
  onToolChange,
  onApplyCrop,
  onCancelCrop,
  onResetCrop,
}: ToolsToolbarProps) {
  const cropActive = activeTool === "crop";
  const hint = isSpacePanActive
    ? "Hold Space and drag to pan"
    : cropActive
      ? "Drag crop handles · Enter Apply · Esc Cancel"
      : getToolHint(activeTool);

  return (
    <div className="tools-toolbar">
      <div className="tools-toolbar-buttons" role="toolbar" aria-label="Editor tools">
        {TOOLBAR_TOOLS.map((toolId) => {
          const tool = TOOL_CONFIG[toolId];
          if (!tool) {
            return null;
          }
          const Icon = tool.icon;
          return (
            <button
              key={toolId}
              type="button"
              className={`tools-toolbar-btn ${activeTool === toolId ? "active" : ""}`}
              onClick={() => onToolChange(toolId)}
              title={`${tool.label} (${tool.hotkey}) — ${getToolHint(toolId)}`}
              aria-pressed={activeTool === toolId}
            >
              <Icon size={15} />
              <span>{tool.label}</span>
            </button>
          );
        })}
        {cropActive && (
          <div className="tools-toolbar-crop-actions" role="group" aria-label="Crop actions">
            <button type="button" className="tools-toolbar-action-btn primary" onClick={onApplyCrop}>
              Apply
            </button>
            <button type="button" className="tools-toolbar-action-btn" onClick={onCancelCrop}>
              Cancel
            </button>
            <button type="button" className="tools-toolbar-action-btn" onClick={onResetCrop}>
              Reset
            </button>
          </div>
        )}
      </div>
      <div className="tools-toolbar-meta">
        <span className="tools-toolbar-hint">{hint}</span>
      </div>
    </div>
  );
}
