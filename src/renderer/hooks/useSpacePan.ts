import { useCallback, useEffect, useRef, useState } from "react";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

type UseSpacePanOptions = {
  enabled?: boolean;
  onTogglePlay: () => void;
};

export function useSpacePan({ enabled = true, onTogglePlay }: UseSpacePanOptions) {
  const [isSpacePanActive, setIsSpacePanActive] = useState(false);
  const spaceDownAtRef = useRef(0);
  const panOccurredRef = useRef(false);

  const markSpacePanOccurred = useCallback(() => {
    panOccurredRef.current = true;
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) {
        return;
      }
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      spaceDownAtRef.current = Date.now();
      panOccurredRef.current = false;
      setIsSpacePanActive(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }
      if (isTypingTarget(event.target)) {
        return;
      }
      setIsSpacePanActive(false);
      const heldMs = Date.now() - spaceDownAtRef.current;
      if (!panOccurredRef.current && heldMs < 400) {
        onTogglePlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, onTogglePlay]);

  return {
    isSpacePanActive,
    markSpacePanOccurred,
  };
}
