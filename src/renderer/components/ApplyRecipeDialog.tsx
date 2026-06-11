import { useState } from "react";
import type { RecipePlan } from "../../effects/applyFilterRecipe";

type ApplyRecipeDialogProps = {
  plan: RecipePlan;
  showDeshakeStrength?: boolean;
  onApply: (options?: { strength?: string }) => void;
  onCancel: () => void;
};

const DESHAKE_STRENGTHS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export default function ApplyRecipeDialog({
  plan,
  showDeshakeStrength = false,
  onApply,
  onCancel,
}: ApplyRecipeDialogProps) {
  const [strength, setStrength] = useState("medium");

  return (
    <div className="recipe-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="recipe-dialog"
        role="dialog"
        aria-labelledby="recipe-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="recipe-dialog-title" className="recipe-dialog-title">
          Apply preset: {plan.recipe.title}
        </h3>
        <p className="recipe-dialog-description">{plan.recipe.description}</p>

        {plan.missingFilters.length > 0 && (
          <div className="recipe-dialog-warning-block">
            <strong>Some filters are missing:</strong>
            <ul>
              {plan.missingFilters.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            {plan.fallbackNote && <p>{plan.fallbackNote}</p>}
          </div>
        )}

        <div className="recipe-dialog-section">
          <strong>This will:</strong>
          <ol className="recipe-dialog-actions">
            {plan.actions
              .filter((action) => !action.skipped)
              .map((action, index) => (
                <li key={`${action.type}-${index}`}>{action.description}</li>
              ))}
          </ol>
        </div>

        {showDeshakeStrength && (
          <div className="recipe-dialog-section">
            <strong>Deshake strength</strong>
            <div className="recipe-dialog-strength-options">
              {DESHAKE_STRENGTHS.map((option) => (
                <label key={option.value} className="recipe-dialog-strength-option">
                  <input
                    type="radio"
                    name="deshake-strength"
                    value={option.value}
                    checked={strength === option.value}
                    onChange={() => setStrength(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {plan.warnings.length > 0 && (
          <ul className="recipe-dialog-warnings">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}

        <div className="recipe-dialog-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              onApply(showDeshakeStrength ? { strength } : undefined)
            }
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
