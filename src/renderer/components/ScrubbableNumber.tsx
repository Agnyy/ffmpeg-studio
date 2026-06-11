import { useCallback, useEffect, useRef, useState } from "react";

export type ScrubbableNumberProps = {
  value: number;
  onChange: (value: number) => void;
  onFocus?: () => void;
  formatValue?: (value: number) => string;
  parseValue?: (text: string, fallback: number) => number;
  min?: number;
  max?: number;
  step?: number;
  sensitivity?: number;
  className?: string;
  disabled?: boolean;
};

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined) {
    next = Math.max(min, next);
  }
  if (max !== undefined) {
    next = Math.min(max, next);
  }
  return next;
}

export default function ScrubbableNumber({
  value,
  onChange,
  onFocus,
  formatValue = (v) => String(v),
  parseValue = (text, fallback) => {
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  min,
  max,
  step = 1,
  sensitivity = 0.5,
  className = "",
  disabled = false,
}: ScrubbableNumberProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const dragRef = useRef<{ startX: number; startValue: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayText = formatValue(value);

  const commitDraft = useCallback(() => {
    const next = clamp(parseValue(draft, value), min, max);
    onChange(next);
    setEditing(false);
  }, [draft, max, min, onChange, parseValue, value]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft(displayText);
  }, [displayText]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const beginEdit = () => {
    if (disabled) {
      return;
    }
    onFocus?.();
    setDraft(displayText);
    setEditing(true);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (disabled || editing || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onFocus?.();
    dragRef.current = { startX: event.clientX, startValue: value };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const deltaPx = event.clientX - drag.startX;
    let delta = deltaPx * sensitivity * step;
    if (event.shiftKey) {
      delta *= 0.1;
    } else if (event.altKey) {
      delta *= 4;
    }
    let next = drag.startValue + delta;
    if (event.ctrlKey) {
      next = Math.round(next);
    }
    onChange(clamp(next, min, max));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    if (!dragRef.current) {
      return;
    }
    dragRef.current = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className={`timeline-property-edit-input ${className}`.trim()}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            commitDraft();
          } else if (e.key === "Escape") {
            cancelEdit();
          }
        }}
        onBlur={commitDraft}
      />
    );
  }

  return (
    <span
      className={`timeline-property-value scrubbable-number ${disabled ? "scrubbable-number-disabled" : ""} ${className}`.trim()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        beginEdit();
      }}
      title="Drag to scrub · Double-click to edit"
    >
      {displayText}
    </span>
  );
}

export function formatPositionValue(value: number): string {
  return String(Math.round(value));
}

export function formatScaleValue(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatRotationValue(value: number): string {
  const turns = Math.floor(value / 360);
  const remainder = value - turns * 360;
  const sign = remainder >= 0 ? "+" : "";
  return `${turns}x ${sign}${remainder.toFixed(1)}°`;
}

export function formatOpacityValue(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatDecibelValue(linearVolume: number): string {
  if (linearVolume <= 0) {
    return "-∞ dB";
  }
  const db = 20 * Math.log10(linearVolume);
  const sign = db >= 0 ? "+" : "";
  return `${sign}${db.toFixed(2)} dB`;
}

export function parseDecibelToLinear(text: string, fallback: number): number {
  const trimmed = text.trim().replace(/\s*dB$/i, "");
  if (trimmed === "-∞" || trimmed === "-inf") {
    return 0;
  }
  const db = Number(trimmed);
  if (!Number.isFinite(db)) {
    return fallback;
  }
  return Math.pow(10, db / 20);
}
