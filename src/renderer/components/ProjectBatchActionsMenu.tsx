import { useEffect, useRef, useState } from "react";

type ProjectBatchActionsMenuProps = {
  selectedCount: number;
  onApplyPreset: () => void;
  onAddToQueue: () => void;
};

export default function ProjectBatchActionsMenu({
  selectedCount,
  onApplyPreset,
  onAddToQueue,
}: ProjectBatchActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (selectedCount < 2) {
    return null;
  }

  return (
    <div className="project-batch-compact" ref={rootRef}>
      <span className="project-batch-compact-count">{selectedCount} selected</span>
      <button
        type="button"
        className="btn btn-ghost btn-sm project-batch-compact-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        Batch Actions…
      </button>
      {open && (
        <div className="project-batch-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onApplyPreset(); }}>
            Apply Preset to Selected
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onAddToQueue(); }}>
            Add to Queue
          </button>
        </div>
      )}
    </div>
  );
}
