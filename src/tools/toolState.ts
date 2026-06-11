import type { EditorTool } from "./toolTypes";

export function getToolLabel(tool: EditorTool): string {
  switch (tool) {
    case "selection":
      return "Selection Tool";
    case "hand":
      return "Hand Tool";
    case "razor":
      return "Razor Tool";
    case "crop":
      return "Crop Tool";
    case "transform":
      return "Transform Tool";
  }
}

export function getToolHint(tool: EditorTool): string {
  switch (tool) {
    case "selection":
      return "Select, move, scale and trim layers";
    case "hand":
      return "Pan timeline";
    case "razor":
      return "Split clip at click position";
    case "crop":
      return "Crop selected layer without changing composition size";
    case "transform":
      return "Move/scale layer in preview";
  }
}

export function getPreviewToolStatusText(
  tool: EditorTool,
  isSpacePanActive: boolean
): string {
  if (isSpacePanActive) {
    return "Hold Space and drag to pan";
  }
  switch (tool) {
    case "selection":
      return "Selection: drag layer to move, drag corners to scale";
    case "razor":
      return "Razor: click clip to split";
    case "crop":
      return "Crop: drag crop handles, Enter to apply, Esc to cancel";
    default:
      return getToolHint(tool);
  }
}

export function getToolCursorClass(tool: EditorTool, isSpacePanActive = false): string {
  if (isSpacePanActive) {
    return "tool-cursor-hand";
  }
  switch (tool) {
    case "selection":
      return "tool-cursor-selection";
    case "hand":
      return "tool-cursor-hand";
    case "razor":
      return "tool-cursor-razor";
    case "crop":
      return "tool-cursor-crop";
    case "transform":
      return "tool-cursor-transform";
  }
}

export const TOOLBAR_TOOLS: EditorTool[] = ["selection", "razor", "crop"];
