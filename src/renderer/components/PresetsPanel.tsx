import { presets } from "../../presets";

type PresetsPanelProps = {
  selectedPresetId: string;
  onPresetChange: (presetId: string) => void;
};

export default function PresetsPanel({
  selectedPresetId,
  onPresetChange,
}: PresetsPanelProps) {
  return (
    <div className="panel-section">
      <p className="panel-section-title">Presets</p>
      <div className="preset-list">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`preset-row ${selectedPresetId === preset.id ? "active" : ""}`}
            onClick={() => onPresetChange(preset.id)}
          >
            <span className="preset-row-title">{preset.title}</span>
            <span className="preset-row-desc">{preset.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
