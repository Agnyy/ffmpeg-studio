import { presets } from "../../presets";
import type { PresetOptions, ResizePresetOption } from "../../shared/types";

type PresetPanelProps = {
  selectedPresetId: string;
  presetOptions: PresetOptions;
  onPresetChange: (presetId: string) => void;
  onOptionsChange: (options: PresetOptions) => void;
};

export default function PresetPanel({
  selectedPresetId,
  presetOptions,
  onPresetChange,
  onOptionsChange,
}: PresetPanelProps) {
  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  return (
    <section className="preset-panel panel">
      <h2 className="panel-title">Presets</h2>
      <div className="preset-grid">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`preset-card ${selectedPresetId === preset.id ? "active" : ""}`}
            onClick={() => onPresetChange(preset.id)}
          >
            <span className="preset-card-title">{preset.title}</span>
            <span className="preset-card-desc">{preset.description}</span>
          </button>
        ))}
      </div>

      {selectedPresetId === "resize-video" && (
        <div className="preset-options">
          <div className="field">
            <label htmlFor="resize-option">Resolution</label>
            <select
              id="resize-option"
              value={presetOptions.resize ?? "1280x720"}
              onChange={(e) =>
                onOptionsChange({
                  ...presetOptions,
                  resize: e.target.value as ResizePresetOption,
                })
              }
            >
              <option value="1920x1080">1920 × 1080</option>
              <option value="1280x720">1280 × 720</option>
              <option value="1080x1080">1080 × 1080</option>
              <option value="1080x1920">1080 × 1920</option>
            </select>
          </div>
        </div>
      )}

      {selectedPresetId === "trim-video" && (
        <div className="preset-options">
          <div className="field">
            <label htmlFor="trim-start">Start time</label>
            <input
              id="trim-start"
              type="text"
              placeholder="00:00:05 or 5"
              value={presetOptions.trimStart ?? "0"}
              onChange={(e) =>
                onOptionsChange({ ...presetOptions, trimStart: e.target.value })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="trim-duration">Duration</label>
            <input
              id="trim-duration"
              type="text"
              placeholder="00:00:10 or 10"
              value={presetOptions.trimDuration ?? "10"}
              onChange={(e) =>
                onOptionsChange({
                  ...presetOptions,
                  trimDuration: e.target.value,
                })
              }
            />
          </div>
        </div>
      )}

      {selectedPreset && (
        <p className="preset-selected-desc">{selectedPreset.description}</p>
      )}

      <style>{`
        .preset-grid {
          display: grid;
          gap: 8px;
        }
        .preset-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--bg-elevated);
          color: var(--text-primary);
          text-align: left;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .preset-card:hover {
          background: var(--bg-hover);
        }
        .preset-card.active {
          border-color: var(--accent);
          background: rgba(79, 140, 255, 0.12);
        }
        .preset-card-title {
          font-weight: 600;
          font-size: 0.95rem;
        }
        .preset-card-desc {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .preset-options {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .preset-selected-desc {
          margin: 12px 0 0;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
      `}</style>
    </section>
  );
}
