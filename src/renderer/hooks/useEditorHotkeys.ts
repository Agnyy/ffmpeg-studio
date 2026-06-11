import { useEffect } from "react";

type UseEditorHotkeysOptions = {
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  onNewProject: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useEditorHotkeys({
  onUndo,
  onRedo,
  onSave,
  onSaveAs,
  onOpen,
  onNewProject,
}: UseEditorHotkeysOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey;
      if (!ctrl) {
        return;
      }

      const typing = isTypingTarget(event.target);

      if (event.code === "KeyS" && event.shiftKey) {
        event.preventDefault();
        onSaveAs();
        return;
      }

      if (event.code === "KeyS") {
        event.preventDefault();
        onSave();
        return;
      }

      if (event.code === "KeyO") {
        event.preventDefault();
        onOpen();
        return;
      }

      if (event.code === "KeyN") {
        event.preventDefault();
        onNewProject();
        return;
      }

      if (typing) {
        return;
      }

      if (event.code === "KeyZ" && event.shiftKey) {
        event.preventDefault();
        onRedo();
        return;
      }

      if (event.code === "KeyY") {
        event.preventDefault();
        onRedo();
        return;
      }

      if (event.code === "KeyZ") {
        event.preventDefault();
        onUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onUndo, onRedo, onSave, onSaveAs, onOpen, onNewProject]);
}
