import type { ReactNode } from "react";
import { Info, Plus } from "lucide-react";
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
            className="effect-preset-row-add-btn"
            aria-label={type === "recipe" ? `Apply ${name}` : `Add ${name}`}
            onClick={(event) => {
              event.stopPropagation();
              onApply();
            }}
          >
            <Plus size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
