import type { LayerEffect } from "../../shared/effects";
import { getEffectParamDefinitions } from "../../keyframes/effectKeyframes";
import ScrubbableNumber from "./ScrubbableNumber";

type VidstabEffectControlsProps = {
  effect: LayerEffect;
  layerId: string;
  filtersAvailable: boolean;
  analysisBusy: boolean;
  onEffectParamChange: (effectId: string, param: string, value: number | string | boolean) => void;
  onAnalyzeMotion: () => void;
  onClearAnalysis: () => void;
  onRenderStabilizedPreview?: () => void;
};

function statusLabel(status: string): string {
  switch (status) {
    case "ready":
      return "Analysis ready";
    case "missing":
      return "Missing analysis";
    default:
      return "Not analyzed";
  }
}

export default function VidstabEffectControls({
  effect,
  filtersAvailable,
  analysisBusy,
  onEffectParamChange,
  onAnalyzeMotion,
  onClearAnalysis,
  onRenderStabilizedPreview,
}: VidstabEffectControlsProps) {
  const status = String(effect.params.analysisStatus ?? "none");
  const numericDefs = getEffectParamDefinitions(effect.type).filter(
    (def) => !["analysisStatus", "analysisPath"].includes(def.param)
  );

  if (!filtersAvailable) {
    return (
      <p className="effect-controls-hint effect-controls-warning">
        VidStab is not available in this FFmpeg build. Use Simple Deshake or install FFmpeg
        with libvidstab.
      </p>
    );
  }

  return (
    <div className="vidstab-effect-controls">
      <p className="vidstab-status">
        Status: <strong>{statusLabel(status)}</strong>
      </p>

      <div className="vidstab-actions">
        <button
          type="button"
          className="btn btn-sm"
          disabled={analysisBusy || status === "ready"}
          onClick={onAnalyzeMotion}
        >
          {analysisBusy ? "Analyzing…" : "Analyze Motion"}
        </button>
        {status === "ready" && onRenderStabilizedPreview && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onRenderStabilizedPreview}
          >
            Render Stabilized Preview
          </button>
        )}
        {(status === "ready" || status === "missing") && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={analysisBusy}
            onClick={onClearAnalysis}
          >
            Clear Analysis
          </button>
        )}
      </div>

      {numericDefs.map((definition) => {
        const raw = effect.params[definition.param];
        const value = typeof raw === "number" ? raw : definition.defaultValue;
        return (
          <label key={definition.param} className="effect-param-row">
            <span>{definition.label}</span>
            <ScrubbableNumber
              value={value}
              min={definition.min}
              max={definition.max}
              step={1}
              onChange={(next) => onEffectParamChange(effect.id, definition.param, next)}
            />
          </label>
        );
      })}

      <label className="effect-param-row">
        <span>Zoom</span>
        <select
          value={String(effect.params.zoom ?? "auto")}
          onChange={(e) => onEffectParamChange(effect.id, "zoom", e.target.value)}
        >
          <option value="auto">Auto</option>
          <option value="manual">Manual</option>
        </select>
      </label>

      {String(effect.params.zoom ?? "auto") === "manual" && (
        <label className="effect-param-row">
          <span>Zoom Amount</span>
          <ScrubbableNumber
            value={Number(effect.params.zoomAmount ?? 0)}
            min={0}
            max={20}
            step={0.5}
            onChange={(next) => onEffectParamChange(effect.id, "zoomAmount", next)}
          />
        </label>
      )}

      <label className="effect-param-row">
        <span>Crop Borders</span>
        <select
          value={String(effect.params.cropBorders ?? "keep")}
          onChange={(e) => onEffectParamChange(effect.id, "cropBorders", e.target.value)}
        >
          <option value="keep">Keep</option>
          <option value="black">Black</option>
        </select>
      </label>

      <label className="effect-param-row effect-param-checkbox">
        <input
          type="checkbox"
          checked={Boolean(effect.params.sharpen ?? true)}
          onChange={(e) => onEffectParamChange(effect.id, "sharpen", e.target.checked)}
        />
        <span>Post Sharpen</span>
      </label>
    </div>
  );
}
