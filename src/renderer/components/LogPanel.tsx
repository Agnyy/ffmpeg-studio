type LogPanelProps = {
  lines: string[];
};

export default function LogPanel({ lines }: LogPanelProps) {
  return (
    <div className="log-block">
      <pre className={`log-content ${lines.length === 0 ? "log-empty" : ""}`}>
        {lines.length > 0
          ? lines.join("\n")
          : "FFmpeg output will appear here when a job runs."}
      </pre>
    </div>
  );
}
