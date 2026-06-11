import { useEffect } from "react";
import type { CommandId } from "../../commands/commandTypes";
import { findCommandByShortcut, shouldIgnoreShortcut } from "../../commands/shortcutManager";

export type CommandHandlers = Partial<Record<CommandId, (event?: KeyboardEvent) => void>>;

const PREVENT_DEFAULT_COMMANDS = new Set<CommandId>([
  "playback.toggle",
  "playback.goToStart",
  "playback.goToEnd",
  "playback.previousFrame",
  "playback.nextFrame",
  "edit.undo",
  "edit.redo",
  "project.save",
  "project.saveAs",
  "project.open",
  "project.new",
  "layer.duplicate",
  "layer.splitAtPlayhead",
  "layer.delete",
  "transform.reset",
  "keyframe.copy",
  "keyframe.paste",
  "keyframe.easyEase",
  "tool.escape",
  "tool.applyCrop",
  "property.showPosition",
  "property.showScale",
  "property.showRotation",
  "property.showOpacity",
  "property.showAnchor",
  "property.showAllChanged",
]);

export function useCommandShortcuts(
  handlers: CommandHandlers,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        return;
      }

      const commandId = findCommandByShortcut(event);
      if (!commandId) {
        return;
      }

      if (shouldIgnoreShortcut(event, commandId)) {
        return;
      }

      const handler = handlers[commandId];
      if (!handler) {
        return;
      }

      if (PREVENT_DEFAULT_COMMANDS.has(commandId)) {
        event.preventDefault();
      }

      handler(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handlers]);
}
