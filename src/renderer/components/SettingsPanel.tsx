import { useEffect, useState } from "react";
import type { FfmpegResolveResult, Settings } from "../../shared/types";

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function SettingsPanel({ open, onClose, onSaved }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>({
    ffmpegSource: "auto",
    customFfmpegPath: "",
    customFfprobePath: "",
    autoCreatePreviewProxy: true,
    previewBackend: "chromium-video",
  });
  const [testResult, setTestResult] = useState<FfmpegResolveResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      window.ffmpegStudio.getSettings().then(setSettings);
      setTestResult(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await window.ffmpegStudio.saveSettings(settings);
      setSettings(saved);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await window.ffmpegStudio.testFfmpeg(settings);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="field">
          <label htmlFor="ffmpeg-source">FFmpeg source</label>
          <select
            id="ffmpeg-source"
            value={settings.ffmpegSource}
            onChange={(e) =>
              setSettings({
                ...settings,
                ffmpegSource: e.target.value as Settings["ffmpegSource"],
              })
            }
          >
            <option value="auto">Auto</option>
            <option value="bundled">Built-in</option>
            <option value="system">System PATH</option>
            <option value="custom">Custom Path</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="custom-ffmpeg">Custom FFmpeg path</label>
          <input
            id="custom-ffmpeg"
            type="text"
            placeholder="C:\\ffmpeg\\bin\\ffmpeg.exe"
            value={settings.customFfmpegPath}
            onChange={(e) =>
              setSettings({ ...settings, customFfmpegPath: e.target.value })
            }
          />
        </div>

        <div className="field">
          <label htmlFor="custom-ffprobe">Custom FFprobe path (optional)</label>
          <input
            id="custom-ffprobe"
            type="text"
            placeholder="Leave empty to derive from FFmpeg path"
            value={settings.customFfprobePath}
            onChange={(e) =>
              setSettings({ ...settings, customFfprobePath: e.target.value })
            }
          />
        </div>

        <div className="field">
          <label htmlFor="preview-backend">Preview backend</label>
          <select
            id="preview-backend"
            value={settings.previewBackend ?? "chromium-video"}
            onChange={(e) =>
              setSettings({
                ...settings,
                previewBackend: e.target.value as Settings["previewBackend"],
              })
            }
          >
            <option value="chromium-video">Chromium video</option>
            <option value="node-av">Experimental node-av</option>
          </select>
          <p className="field-hint">
            Chromium video is the default editor preview. node-av is still/scrub fallback for
            incompatible files.
          </p>
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? "Testing…" : "Test FFmpeg"}
          </button>
          <button type="button" className="btn" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {testResult && (
          <div className={`settings-test-result ${testResult.ok ? "ok" : "error"}`}>
            {testResult.ok ? (
              <>
                <strong>FFmpeg OK</strong>
                <div>Source: {testResult.source}</div>
                <div>Path: {testResult.ffmpegPath}</div>
                <pre>{testResult.version}</pre>
              </>
            ) : (
              <>
                <strong>FFmpeg test failed</strong>
                <div>{testResult.error}</div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
