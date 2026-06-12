type LogPanelProps = {
  lines: string[];
  onClear?: () => void;
};

export default function LogPanel({ lines, onClear }: LogPanelProps) {
  const copyLog = async () => {
    if (lines.length === 0) {
      return;
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      // ignore
    }
  };

  return (
    <div className="log-block">
      <div className="log-block-toolbar">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void copyLog()}
          disabled={lines.length === 0}
        >
          Copy log
        </button>
        {onClear && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClear}
            disabled={lines.length === 0}
          >
            Clear
          </button>
        )}
      </div>
      <pre className={`log-content ${lines.length === 0 ? "log-empty" : ""}`}>
        {lines.length > 0
          ? lines.join("\n")
          : "FFmpeg output will appear here when a job runs."}
      </pre>
    </div>
  );
}
