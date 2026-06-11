import type { CommandId } from "./commandTypes";
import { DEFAULT_SHORTCUTS } from "./commandRegistry";

const GLOBAL_IN_INPUT_COMMANDS = new Set<CommandId>([
  "edit.undo",
  "edit.redo",
  "project.save",
  "project.saveAs",
  "project.open",
  "project.new",
]);

const CODE_TO_KEY: Record<string, string> = {
  Space: "Space",
  Delete: "Delete",
  Backspace: "Backspace",
  BracketLeft: "[",
  BracketRight: "]",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  Home: "Home",
  End: "End",
  Escape: "Escape",
  Enter: "Enter",
};

function codeToKey(code: string): string | null {
  if (CODE_TO_KEY[code]) {
    return CODE_TO_KEY[code];
  }
  if (/^F\d+$/.test(code)) {
    return code;
  }
  if (code.startsWith("Key")) {
    return code.slice(3);
  }
  if (code.startsWith("Digit")) {
    return code.slice(5);
  }
  return null;
}

export function eventToShortcut(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push("Ctrl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }

  const key = codeToKey(event.code);
  if (key) {
    parts.push(key);
  }

  return parts.join("+");
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function shouldIgnoreShortcut(event: KeyboardEvent, commandId: CommandId | null): boolean {
  if (!commandId) {
    return true;
  }
  if (GLOBAL_IN_INPUT_COMMANDS.has(commandId)) {
    return false;
  }
  return isTypingTarget(event.target);
}

const shortcutLookup = new Map<string, CommandId>();
for (const definition of DEFAULT_SHORTCUTS) {
  for (const keys of definition.keys) {
    shortcutLookup.set(keys, definition.commandId);
  }
}

export function findCommandByShortcut(event: KeyboardEvent): CommandId | null {
  const combo = eventToShortcut(event);
  return shortcutLookup.get(combo) ?? null;
}
