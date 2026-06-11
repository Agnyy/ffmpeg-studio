import type { CommandId, ShortcutCategory } from "./commandTypes";

export type ShortcutDefinition = {
  commandId: CommandId;
  label: string;
  keys: string[];
  category: ShortcutCategory;
  aeLike?: boolean;
};

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    commandId: "playback.toggle",
    label: "Play / Pause",
    keys: ["Space"],
    category: "Playback",
    aeLike: true,
  },
  {
    commandId: "playback.goToStart",
    label: "Go to Start",
    keys: ["Home"],
    category: "Playback",
  },
  {
    commandId: "playback.goToEnd",
    label: "Go to End",
    keys: ["End"],
    category: "Playback",
  },
  {
    commandId: "playback.previousFrame",
    label: "Previous Frame",
    keys: ["Ctrl+ArrowLeft"],
    category: "Playback",
    aeLike: true,
  },
  {
    commandId: "playback.nextFrame",
    label: "Next Frame",
    keys: ["Ctrl+ArrowRight"],
    category: "Playback",
    aeLike: true,
  },
  {
    commandId: "workArea.setStart",
    label: "Set Work Area Start to Playhead",
    keys: ["B"],
    category: "Timeline",
    aeLike: true,
  },
  {
    commandId: "workArea.setEnd",
    label: "Set Work Area End to Playhead",
    keys: ["N"],
    category: "Timeline",
    aeLike: true,
  },
  {
    commandId: "layer.moveStartToPlayhead",
    label: "Move Layer In Point to Playhead",
    keys: ["["],
    category: "Layer",
    aeLike: true,
  },
  {
    commandId: "layer.moveEndToPlayhead",
    label: "Move Layer Out Point to Playhead",
    keys: ["]"],
    category: "Layer",
    aeLike: true,
  },
  {
    commandId: "layer.trimInToPlayhead",
    label: "Trim Layer In Point to Playhead",
    keys: ["Alt+["],
    category: "Layer",
    aeLike: true,
  },
  {
    commandId: "layer.trimOutToPlayhead",
    label: "Trim Layer Out Point to Playhead",
    keys: ["Alt+]"],
    category: "Layer",
    aeLike: true,
  },
  {
    commandId: "layer.moveDown",
    label: "Move Layer Down",
    keys: ["Ctrl+["],
    category: "Layer",
    aeLike: true,
  },
  {
    commandId: "layer.moveUp",
    label: "Move Layer Up",
    keys: ["Ctrl+]"],
    category: "Layer",
    aeLike: true,
  },
  {
    commandId: "layer.moveToBottom",
    label: "Move Layer to Bottom",
    keys: ["Ctrl+Shift+["],
    category: "Layer",
    aeLike: true,
  },
  {
    commandId: "layer.moveToTop",
    label: "Move Layer to Top",
    keys: ["Ctrl+Shift+]"],
    category: "Layer",
    aeLike: true,
  },
  {
    commandId: "property.showPosition",
    label: "Show Position",
    keys: ["P", "Shift+P"],
    category: "Properties",
    aeLike: true,
  },
  {
    commandId: "property.showScale",
    label: "Show Scale",
    keys: ["S", "Shift+S"],
    category: "Properties",
    aeLike: true,
  },
  {
    commandId: "property.showRotation",
    label: "Show Rotation",
    keys: ["R", "Shift+R"],
    category: "Properties",
    aeLike: true,
  },
  {
    commandId: "property.showOpacity",
    label: "Show Opacity",
    keys: ["T", "Shift+T"],
    category: "Properties",
    aeLike: true,
  },
  {
    commandId: "property.showAnchor",
    label: "Show Anchor Point",
    keys: ["A", "Shift+A"],
    category: "Properties",
    aeLike: true,
  },
  {
    commandId: "property.showAllChanged",
    label: "Show Changed Properties",
    keys: ["U"],
    category: "Properties",
    aeLike: true,
  },
  {
    commandId: "composition.precompose",
    label: "Pre-compose Selected Layers",
    keys: ["Ctrl+Shift+C"],
    category: "Layer",
    aeLike: true,
  },
  {
    commandId: "layer.splitAtPlayhead",
    label: "Split Layer at Playhead",
    keys: ["Ctrl+Shift+D"],
    category: "Layer",
    aeLike: true,
  },
  {
    commandId: "tool.selection",
    label: "Selection Tool",
    keys: ["V"],
    category: "Tools",
    aeLike: true,
  },
  {
    commandId: "tool.razor",
    label: "Razor Tool",
    keys: ["G"],
    category: "Tools",
    aeLike: true,
  },
  {
    commandId: "tool.crop",
    label: "Crop Tool",
    keys: ["C"],
    category: "Tools",
    aeLike: true,
  },
  {
    commandId: "tool.escape",
    label: "Selection Tool / Cancel",
    keys: ["Escape"],
    category: "Tools",
    aeLike: true,
  },
  {
    commandId: "tool.applyCrop",
    label: "Apply Crop",
    keys: ["Enter"],
    category: "Tools",
    aeLike: true,
  },
  {
    commandId: "layer.duplicate",
    label: "Duplicate Layer",
    keys: ["Ctrl+D"],
    category: "Layer",
    aeLike: true,
  },
  {
    commandId: "layer.delete",
    label: "Delete Selected Layer / Keyframes",
    keys: ["Delete", "Backspace"],
    category: "Layer",
  },
  {
    commandId: "transform.reset",
    label: "Reset Transform",
    keys: ["Ctrl+R"],
    category: "Properties",
  },
  {
    commandId: "keyframe.previous",
    label: "Previous Keyframe",
    keys: ["J"],
    category: "Timeline",
    aeLike: true,
  },
  {
    commandId: "keyframe.next",
    label: "Next Keyframe",
    keys: ["K"],
    category: "Timeline",
    aeLike: true,
  },
  {
    commandId: "animation.togglePosition",
    label: "Toggle Position Animation",
    keys: ["Alt+P"],
    category: "Properties",
    aeLike: true,
  },
  {
    commandId: "animation.toggleScale",
    label: "Toggle Scale Animation",
    keys: ["Alt+S"],
    category: "Properties",
    aeLike: true,
  },
  {
    commandId: "animation.toggleRotation",
    label: "Toggle Rotation Animation",
    keys: ["Alt+R"],
    category: "Properties",
    aeLike: true,
  },
  {
    commandId: "animation.toggleOpacity",
    label: "Toggle Opacity Animation",
    keys: ["Alt+T"],
    category: "Properties",
    aeLike: true,
  },
  {
    commandId: "keyframe.easyEase",
    label: "Easy Ease Selected Keyframes",
    keys: ["F9"],
    category: "Timeline",
    aeLike: true,
  },
  {
    commandId: "keyframe.copy",
    label: "Copy Selected Keyframes",
    keys: ["Ctrl+C"],
    category: "Timeline",
    aeLike: true,
  },
  {
    commandId: "keyframe.paste",
    label: "Paste Keyframes at Playhead",
    keys: ["Ctrl+V"],
    category: "Timeline",
    aeLike: true,
  },
  {
    commandId: "edit.undo",
    label: "Undo",
    keys: ["Ctrl+Z"],
    category: "Edit",
  },
  {
    commandId: "edit.redo",
    label: "Redo",
    keys: ["Ctrl+Y", "Ctrl+Shift+Z"],
    category: "Edit",
  },
  {
    commandId: "project.save",
    label: "Save Project",
    keys: ["Ctrl+S"],
    category: "Project",
  },
  {
    commandId: "project.saveAs",
    label: "Save Project As",
    keys: ["Ctrl+Shift+S"],
    category: "Project",
  },
  {
    commandId: "project.open",
    label: "Open Project",
    keys: ["Ctrl+O"],
    category: "Project",
  },
  {
    commandId: "project.new",
    label: "New Project",
    keys: ["Ctrl+N"],
    category: "Project",
  },
];

export function getShortcutLabel(commandId: CommandId): string {
  return DEFAULT_SHORTCUTS.find((entry) => entry.commandId === commandId)?.label ?? commandId;
}

export function getShortcutsByCategory(): Record<ShortcutCategory, ShortcutDefinition[]> {
  const grouped = {} as Record<ShortcutCategory, ShortcutDefinition[]>;
  for (const shortcut of DEFAULT_SHORTCUTS) {
    if (!grouped[shortcut.category]) {
      grouped[shortcut.category] = [];
    }
    grouped[shortcut.category].push(shortcut);
  }
  return grouped;
}
