import { useEffect } from "react";

type UsePlaybackHotkeysOptions = {
  enabled: boolean;
  onTogglePlay: () => void;
  onGoToStart: () => void;
  onGoToEnd: () => void;
  onPrevFrame: () => void;
  onNextFrame: () => void;
  onDelete: () => void;
  onFocusField?: (fieldId: string) => void;
  onResetTransform?: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function usePlaybackHotkeys({
  enabled,
  onTogglePlay,
  onGoToStart,
  onGoToEnd,
  onPrevFrame,
  onNextFrame,
  onDelete,
  onFocusField,
  onResetTransform,
}: UsePlaybackHotkeysOptions): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.ctrlKey && event.code === "KeyR") {
        event.preventDefault();
        onResetTransform?.();
        return;
      }

      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      switch (event.code) {
        case "Space":
          event.preventDefault();
          onTogglePlay();
          break;
        case "Home":
          event.preventDefault();
          onGoToStart();
          break;
        case "End":
          event.preventDefault();
          onGoToEnd();
          break;
        case "ArrowLeft":
          event.preventDefault();
          onPrevFrame();
          break;
        case "ArrowRight":
          event.preventDefault();
          onNextFrame();
          break;
        case "Delete":
          onDelete();
          break;
        case "KeyP":
          onFocusField?.("transform-pos-x");
          break;
        case "KeyT":
          onFocusField?.("transform-opacity");
          break;
        case "KeyS":
          onFocusField?.("transform-scale-x");
          break;
        case "KeyR":
          onFocusField?.("transform-rotation");
          break;
        case "KeyV":
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    onTogglePlay,
    onGoToStart,
    onGoToEnd,
    onPrevFrame,
    onNextFrame,
    onDelete,
    onFocusField,
    onResetTransform,
  ]);
}
