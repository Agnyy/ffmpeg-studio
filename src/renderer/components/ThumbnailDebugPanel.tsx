import { useCallback, useEffect, useState } from "react";
import { runThumbnailDebugPipe } from "../../media/thumbnailDebugPipe";

type ThumbnailDebugPanelProps = {
  footagePath: string | null;
};

export default function ThumbnailDebugPanel({ footagePath }: ThumbnailDebugPanelProps) {
  const [inputPath, setInputPath] = useState(footagePath ?? "");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [byteLength, setByteLength] = useState(0);
  const [head, setHead] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (footagePath) {
      setInputPath(footagePath);
    }
  }, [footagePath]);

  const handleTest = useCallback(async () => {
    setBusy(true);
    setDataUrl(null);
    setByteLength(0);
    setHead("");
    setError(null);

    const result = await runThumbnailDebugPipe(inputPath);
    setDataUrl(result.dataUrl);
    setByteLength(result.byteLength);
    setHead(result.head);
    setError(result.error);
    setBusy(false);
  }, [inputPath]);

  return (
    <div className="thumbnail-debug-panel">
      <header className="thumbnail-debug-header">
        <h3 className="thumbnail-debug-title">Thumbnail Debug</h3>
        <p className="thumbnail-debug-note">
          Isolated FFmpeg pipe test. Does not affect preview or Project Panel.
        </p>
      </header>

      <label className="thumbnail-debug-field">
        <span className="thumbnail-debug-label">Footage path</span>
        <input
          type="text"
          className="thumbnail-debug-input"
          value={inputPath}
          onChange={(event) => setInputPath(event.target.value)}
          placeholder="Select footage in Project Panel or paste a path"
          spellCheck={false}
        />
      </label>

      <button
        type="button"
        className="btn btn-primary btn-sm thumbnail-debug-test-btn"
        onClick={() => void handleTest()}
        disabled={busy || !inputPath.trim()}
      >
        {busy ? "Testing…" : "Test Thumbnail"}
      </button>

      <dl className="thumbnail-debug-meta">
        <div>
          <dt>byteLength</dt>
          <dd>{byteLength > 0 ? byteLength : "—"}</dd>
        </div>
        <div>
          <dt>head</dt>
          <dd className="thumbnail-debug-head">{head || "—"}</dd>
        </div>
        <div>
          <dt>error</dt>
          <dd className={error ? "thumbnail-debug-error" : ""}>{error || "—"}</dd>
        </div>
      </dl>

      {dataUrl ? (
        <div className="thumbnail-debug-preview">
          <img src={dataUrl} alt="Thumbnail debug preview" className="thumbnail-debug-image" />
        </div>
      ) : (
        <p className="thumbnail-debug-empty">No thumbnail image yet.</p>
      )}
    </div>
  );
}
