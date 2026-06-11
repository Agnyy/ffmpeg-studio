import { useState } from "react";
import type { CompositionMeta } from "../../shared/project";

export type CompositionSettingsValues = {
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
};

type CompositionSettingsDialogProps = {
  initial: CompositionSettingsValues;
  onSave: (values: CompositionSettingsValues) => void;
  onCancel: () => void;
};

export default function CompositionSettingsDialog({
  initial,
  onSave,
  onCancel,
}: CompositionSettingsDialogProps) {
  const [name, setName] = useState(initial.name);
  const [width, setWidth] = useState(String(initial.width));
  const [height, setHeight] = useState(String(initial.height));
  const [fps, setFps] = useState(String(initial.fps));
  const [duration, setDuration] = useState(String(initial.duration));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedWidth = Math.max(16, Math.round(Number(width) || initial.width));
    const parsedHeight = Math.max(16, Math.round(Number(height) || initial.height));
    const parsedFps = Math.max(1, Number(fps) || initial.fps);
    const parsedDuration = Math.max(0.1, Number(duration) || initial.duration);
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    onSave({
      name: trimmedName,
      width: parsedWidth,
      height: parsedHeight,
      fps: parsedFps,
      duration: parsedDuration,
    });
  };

  return (
    <div className="recipe-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="recipe-dialog composition-settings-dialog"
        role="dialog"
        aria-labelledby="composition-settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="composition-settings-title" className="recipe-dialog-title">
          Composition Settings
        </h3>
        <form className="composition-settings-form" onSubmit={handleSubmit}>
          <label className="composition-settings-field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </label>
          <div className="composition-settings-row">
            <label className="composition-settings-field">
              <span>Width</span>
              <input
                type="number"
                min={16}
                value={width}
                onChange={(event) => setWidth(event.target.value)}
              />
            </label>
            <label className="composition-settings-field">
              <span>Height</span>
              <input
                type="number"
                min={16}
                value={height}
                onChange={(event) => setHeight(event.target.value)}
              />
            </label>
          </div>
          <div className="composition-settings-row">
            <label className="composition-settings-field">
              <span>FPS</span>
              <input
                type="number"
                min={1}
                step={0.01}
                value={fps}
                onChange={(event) => setFps(event.target.value)}
              />
            </label>
            <label className="composition-settings-field">
              <span>Duration (s)</span>
              <input
                type="number"
                min={0.1}
                step={0.01}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </label>
          </div>
          <div className="recipe-dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function compositionMetaToSettings(
  item: { name: string; composition?: CompositionMeta }
): CompositionSettingsValues {
  const meta = item.composition;
  return {
    name: item.name,
    width: meta?.width ?? 1280,
    height: meta?.height ?? 720,
    fps: meta?.fps ?? 30,
    duration: meta?.duration ?? 10,
  };
}
