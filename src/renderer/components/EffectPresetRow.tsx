import type { ReactNode } from "react";
import { Info } from "lucide-react";
import type { CompactBadge } from "./effectPresetRowUtils";

export type EffectPresetRowProps = {
  rowId: string;
  icon: ReactNode;
  name: string;
  type: "recipe" | "effect";
  badges: CompactBadge[];
  disabled: boolean;
  selected: boolean;
  depth: number;
  title?: string;
  onSelect: () => void;
  onApply: () => void;
  onInfo: (anchor: HTMLElement) => void;
};

export default function EffectPresetRow({
  icon,
  name,
  type,
  badges,
  disabled,
  selected,
  depth,
  title,
  onSelect,
  onApply,
  onInfo,
}: EffectPresetRowProps) {
  const applyLabel = type === "recipe" ? "Apply" : "Apply";
  const applyAriaLabel =
    type === "recipe"
      ? `Apply preset ${name} to selected layer`
      : `Apply filter ${name} to selected layer`;

  return (
    <div
      className={`effect-preset-row ${disabled ? "effect-preset-row-disabled" : ""} ${
        selected ? "effect-preset-row-selected" : ""
      }`}
      style={{ paddingLeft: `${12 + depth * 14}px` }}
      title={title}
    >
      <button
        type="button"
        className="effect-preset-row-main"
        disabled={false}
        onClick={onSelect}
        onDoubleClick={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <span className="effect-preset-row-icon">{icon}</span>
        <span className="effect-preset-row-name">{name}</span>
        {badges.length > 0 && (
          <span className="effect-preset-row-badges">
            {badges.map((badge) => (
              <span
                key={badge.kind}
                className={`effect-capability-badge effect-capability-${badge.kind}`}
                title={badge.title}
              >
                {badge.label}
              </span>
            ))}
          </span>
        )}
      </button>

      <div className="effect-preset-row-actions">
        <button
          type="button"
          className="effect-preset-row-info-btn"
          aria-label={`Info about ${name}`}
          onClick={(event) => {
            event.stopPropagation();
            onInfo(event.currentTarget);
          }}
        >
          <Info size={12} />
        </button>
        {!disabled && (
          <button
            type="button"
            className="effect-preset-row-apply-btn"
            title="Apply to selected layer"
            aria-label={applyAriaLabel}
            onClick={(event) => {
              event.stopPropagation();
              onApply();
            }}
          >
            {applyLabel}
          </button>
        )}
      </div>
    </div>
  );
}
