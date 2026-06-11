import { useMemo, useState } from "react";
import { getBatchSupportedRecipes } from "../../batch/batchRecipes";
import {
  buildBatchOutputFilename,
  getDefaultBatchFilenameTemplate,
  type BatchFilenameTemplate,
} from "../../batch/batchOutputNaming";
import type { ProjectItem } from "../../shared/project";
import { getBasename } from "../../shared/pathUtils";

export type BatchApplyOptions = {
  recipeId: string;
  outputMode: "same-folder" | "custom-folder";
  outputFolder: string | null;
  filenameTemplate: BatchFilenameTemplate;
  deshakeStrength?: string;
};

type BatchApplyRecipeDialogProps = {
  items: ProjectItem[];
  defaultRecipeId?: string;
  onApply: (options: BatchApplyOptions) => void;
  onCancel: () => void;
};

const FILENAME_TEMPLATES: { id: BatchFilenameTemplate; label: string }[] = [
  { id: "preset", label: "{original_name}_{preset}.mp4" },
  { id: "processed", label: "{original_name}_processed.mp4" },
  { id: "telegram", label: "{original_name}_telegram.mp4" },
  { id: "shorts", label: "{original_name}_shorts.mp4" },
];

export default function BatchApplyRecipeDialog({
  items,
  defaultRecipeId,
  onApply,
  onCancel,
}: BatchApplyRecipeDialogProps) {
  const recipes = useMemo(() => getBatchSupportedRecipes(), []);
  const [recipeId, setRecipeId] = useState(
    defaultRecipeId ?? recipes[0]?.id ?? "compress-for-telegram"
  );
  const [outputMode, setOutputMode] = useState<"same-folder" | "custom-folder">("same-folder");
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [filenameTemplate, setFilenameTemplate] = useState<BatchFilenameTemplate>(
    getDefaultBatchFilenameTemplate(recipeId)
  );
  const [deshakeStrength, setDeshakeStrength] = useState("medium");

  const selectedRecipe = recipes.find((entry) => entry.id === recipeId) ?? recipes[0];
  const previewItem = items[0];
  const previewName = previewItem?.path
    ? buildBatchOutputFilename(previewItem.path, recipeId, filenameTemplate)
    : "output.mp4";

  const handleRecipeChange = (nextId: string) => {
    setRecipeId(nextId);
    setFilenameTemplate(getDefaultBatchFilenameTemplate(nextId));
  };

  const handleChooseFolder = async () => {
    const folder = await window.ffmpegStudio.chooseOutputFolder();
    if (folder) {
      setOutputFolder(folder);
      setOutputMode("custom-folder");
    }
  };

  return (
    <div className="recipe-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="recipe-dialog batch-apply-dialog"
        role="dialog"
        aria-labelledby="batch-apply-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="batch-apply-title" className="recipe-dialog-title">
          Apply preset to {items.length} file{items.length === 1 ? "" : "s"}
        </h3>

        <div className="batch-apply-field">
          <label className="batch-apply-label" htmlFor="batch-recipe-select">
            Preset
          </label>
          <select
            id="batch-recipe-select"
            className="batch-apply-select"
            value={recipeId}
            onChange={(e) => handleRecipeChange(e.target.value)}
          >
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.title}
              </option>
            ))}
          </select>
          {selectedRecipe && (
            <p className="batch-apply-hint">{selectedRecipe.description}</p>
          )}
        </div>

        <div className="batch-apply-field">
          <span className="batch-apply-label">Output</span>
          <div className="batch-apply-radio-group">
            <label>
              <input
                type="radio"
                name="batch-output-mode"
                checked={outputMode === "same-folder"}
                onChange={() => setOutputMode("same-folder")}
              />
              Same folder as source
            </label>
            <label>
              <input
                type="radio"
                name="batch-output-mode"
                checked={outputMode === "custom-folder"}
                onChange={() => setOutputMode("custom-folder")}
              />
              Choose folder
            </label>
          </div>
          {outputMode === "custom-folder" && (
            <div className="batch-apply-folder-row">
              <span className="batch-apply-folder-path">
                {outputFolder ?? "No folder selected"}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleChooseFolder()}>
                Browse…
              </button>
            </div>
          )}
        </div>

        <div className="batch-apply-field">
          <label className="batch-apply-label" htmlFor="batch-filename-template">
            Filename
          </label>
          <select
            id="batch-filename-template"
            className="batch-apply-select"
            value={filenameTemplate}
            onChange={(e) => setFilenameTemplate(e.target.value as BatchFilenameTemplate)}
          >
            {FILENAME_TEMPLATES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          {previewItem?.path && (
            <p className="batch-apply-hint">
              Example: {previewName}
              {items.length > 1 ? ` (+${items.length - 1} more)` : ""}
            </p>
          )}
        </div>

        {recipeId === "quick-deshake" && (
          <div className="batch-apply-field">
            <span className="batch-apply-label">Deshake strength</span>
            <div className="recipe-dialog-strength-options">
              {(["low", "medium", "high"] as const).map((value) => (
                <label key={value} className="recipe-dialog-strength-option">
                  <input
                    type="radio"
                    name="batch-deshake-strength"
                    value={value}
                    checked={deshakeStrength === value}
                    onChange={() => setDeshakeStrength(value)}
                  />
                  {value[0].toUpperCase() + value.slice(1)}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="recipe-dialog-section">
          <strong>Actions:</strong>
          <ul className="recipe-dialog-actions">
            <li>Create {items.length} render job{items.length === 1 ? "" : "s"}</li>
            <li>Use original source files (no timeline required)</li>
            <li>Output MP4 H.264 / AAC</li>
            <li>Jobs run one at a time in Tasks</li>
          </ul>
          <ul className="recipe-dialog-warnings">
            {items.slice(0, 5).map((item) => (
              <li key={item.id}>{getBasename(item.path ?? item.name)}</li>
            ))}
            {items.length > 5 && <li>…and {items.length - 5} more</li>}
          </ul>
        </div>

        <div className="recipe-dialog-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={outputMode === "custom-folder" && !outputFolder}
            onClick={() =>
              onApply({
                recipeId,
                outputMode,
                outputFolder,
                filenameTemplate,
                deshakeStrength: recipeId === "quick-deshake" ? deshakeStrength : undefined,
              })
            }
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
