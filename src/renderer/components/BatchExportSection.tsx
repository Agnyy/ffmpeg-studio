import { useMemo, useState } from "react";
import { getBatchSupportedRecipes } from "../../batch/batchRecipes";
import {
  buildBatchOutputFilename,
  getDefaultBatchFilenameTemplate,
  type BatchFilenameTemplate,
} from "../../batch/batchOutputNaming";
import type { ProjectItem } from "../../shared/project";
import type { BatchApplyOptions } from "./BatchApplyRecipeDialog";

type BatchExportSectionProps = {
  selectedFootageItems: ProjectItem[];
  onApplyBatch: (options: BatchApplyOptions) => void;
  onOpenExportTabHint?: () => void;
};

const FILENAME_TEMPLATES: { id: BatchFilenameTemplate; label: string }[] = [
  { id: "preset", label: "{original_name}_{preset}.mp4" },
  { id: "processed", label: "{original_name}_processed.mp4" },
  { id: "telegram", label: "{original_name}_telegram.mp4" },
  { id: "shorts", label: "{original_name}_shorts.mp4" },
];

export default function BatchExportSection({
  selectedFootageItems,
  onApplyBatch,
}: BatchExportSectionProps) {
  const recipes = useMemo(() => getBatchSupportedRecipes(), []);
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "compress-for-telegram");
  const [outputMode, setOutputMode] = useState<"same-folder" | "custom-folder">("same-folder");
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [filenameTemplate, setFilenameTemplate] = useState<BatchFilenameTemplate>(
    getDefaultBatchFilenameTemplate(recipeId)
  );
  const [deshakeStrength, setDeshakeStrength] = useState("medium");

  const count = selectedFootageItems.length;
  const previewName = selectedFootageItems[0]?.path
    ? buildBatchOutputFilename(selectedFootageItems[0].path, recipeId, filenameTemplate)
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

  if (count < 2) {
    return (
      <div className="export-panel-block export-batch-section">
        <h3 className="export-panel-title">Batch Export</h3>
        <p className="export-batch-hint">
          Select two or more footage items in the Project panel to run batch export.
        </p>
      </div>
    );
  }

  return (
    <div className="export-panel-block export-batch-section">
      <h3 className="export-panel-title">Batch Export</h3>
      <p className="export-batch-hint">{count} media items selected for batch processing.</p>

      <div className="field">
        <label htmlFor="batch-export-recipe">Preset</label>
        <select
          id="batch-export-recipe"
          value={recipeId}
          onChange={(e) => handleRecipeChange(e.target.value)}
        >
          {recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.title}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="export-panel-label">Output</span>
        <label className="export-batch-radio">
          <input
            type="radio"
            name="batch-output-mode"
            checked={outputMode === "same-folder"}
            onChange={() => setOutputMode("same-folder")}
          />
          Same folder as source
        </label>
        <label className="export-batch-radio">
          <input
            type="radio"
            name="batch-output-mode"
            checked={outputMode === "custom-folder"}
            onChange={() => setOutputMode("custom-folder")}
          />
          Choose folder
        </label>
        {outputMode === "custom-folder" && (
          <div className="export-batch-folder-row">
            <span className="export-batch-folder-path">{outputFolder ?? "No folder selected"}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleChooseFolder()}>
              Browse…
            </button>
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="batch-filename-template">Filename</label>
        <select
          id="batch-filename-template"
          value={filenameTemplate}
          onChange={(e) => setFilenameTemplate(e.target.value as BatchFilenameTemplate)}
        >
          {FILENAME_TEMPLATES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
        <p className="export-batch-example">Example: {previewName}</p>
      </div>

      {recipeId === "quick-deshake" && (
        <div className="field">
          <span className="export-panel-label">Deshake strength</span>
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

      <button
        type="button"
        className="btn btn-primary export-batch-apply"
        disabled={outputMode === "custom-folder" && !outputFolder}
        onClick={() =>
          onApplyBatch({
            recipeId,
            outputMode,
            outputFolder,
            filenameTemplate,
            deshakeStrength: recipeId === "quick-deshake" ? deshakeStrength : undefined,
          })
        }
      >
        Create {count} Batch Jobs
      </button>
    </div>
  );
}
