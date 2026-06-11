import { useEffect, useRef } from "react";
import type { RecipePlan } from "../../effects/applyFilterRecipe";
import type { FfmpegEffectDefinition } from "../../effects/ffmpegEffectCatalog";
import type { FilterRecipe } from "../../effects/filterRecipes";
import { badgeShortLabel, type CompactBadge } from "./effectPresetRowUtils";

type EffectPresetInfoPopoverProps = {
  anchorRect: DOMRect;
  type: "recipe" | "effect";
  name: string;
  recipe?: FilterRecipe;
  plan?: RecipePlan;
  catalogDef?: FfmpegEffectDefinition;
  hiddenBadges?: CompactBadge[];
  onClose: () => void;
};

export default function EffectPresetInfoPopover({
  anchorRect,
  type,
  name,
  recipe,
  plan,
  catalogDef,
  hiddenBadges = [],
  onClose,
}: EffectPresetInfoPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 240);
  const left = Math.min(anchorRect.left, window.innerWidth - 280);

  return (
    <div
      ref={ref}
      className="effect-preset-info-popover"
      style={{ top, left }}
      role="dialog"
      aria-label={`${name} details`}
    >
      <h4 className="effect-preset-info-title">{name}</h4>

      {type === "recipe" && recipe && plan && (
        <>
          <p className="effect-preset-info-desc">{recipe.description}</p>
          {plan.fallbackNote && <p className="effect-preset-info-note">{plan.fallbackNote}</p>}

          {plan.actions.filter((action) => !action.skipped).length > 0 && (
            <div className="effect-preset-info-section">
              <strong>Will apply:</strong>
              <ul>
                {plan.actions
                  .filter((action) => !action.skipped)
                  .map((action, index) => (
                    <li key={`${action.type}-${index}`}>{action.description}</li>
                  ))}
              </ul>
            </div>
          )}

          {recipe.requiredFilters.length > 0 && (
            <div className="effect-preset-info-section">
              <strong>Requirements:</strong>
              <ul>
                {recipe.requiredFilters.map((filter) => (
                  <li key={filter}>{filter}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.missingFilters.length > 0 && (
            <div className="effect-preset-info-section effect-preset-info-missing">
              <strong>Unavailable:</strong>
              <ul>
                {plan.missingFilters.map((filter) => (
                  <li key={filter}>{filter}</li>
                ))}
              </ul>
              {plan.disabledReason && <p>{plan.disabledReason}</p>}
            </div>
          )}

          {plan.warnings.length > 0 && (
            <div className="effect-preset-info-section">
              <strong>Notes:</strong>
              <ul>
                {plan.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {type === "effect" && (
        <>
          {catalogDef ? (
            <>
              <p className="effect-preset-info-desc">{catalogDef.description}</p>
              {catalogDef.ffmpegFilters.length > 0 && (
                <div className="effect-preset-info-section">
                  <strong>FFmpeg:</strong>
                  <p>{catalogDef.ffmpegFilters.join(", ")}</p>
                </div>
              )}
              {catalogDef.missingHint && (
                <p className="effect-preset-info-note">{catalogDef.missingHint}</p>
              )}
            </>
          ) : (
            <p className="effect-preset-info-desc">Built-in effect (preview supported).</p>
          )}
        </>
      )}

      {hiddenBadges.length > 0 && (
        <div className="effect-preset-info-section">
          <strong>Also:</strong>
          <p>{hiddenBadges.map((badge) => badgeShortLabel(badge.kind)).join(", ")}</p>
        </div>
      )}
    </div>
  );
}
