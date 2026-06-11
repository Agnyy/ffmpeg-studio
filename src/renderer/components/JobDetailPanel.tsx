import type { Job } from "../../shared/types";
import { getJobDisplayTitle, inferJobKind, jobKindLabel } from "../../jobs/jobUtils";

type JobDetailPanelProps = {
  job: Job | null;
  onOpenOutput?: (outputPath: string) => void;
};

export default function JobDetailPanel({ job, onOpenOutput }: JobDetailPanelProps) {
  if (!job) {
    return (
      <div className="job-detail-empty">
        Select a task to view logs and details.
      </div>
    );
  }

  const copyLog = async () => {
    const text = job.log.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const copyCommand = async () => {
    if (!job.command) {
      return;
    }
    try {
      await navigator.clipboard.writeText(job.command);
    } catch {
      // ignore
    }
  };

  return (
    <div className="job-detail-panel">
      <div className="job-detail-header">
        <div>
          <h4 className="job-detail-title">{getJobDisplayTitle(job)}</h4>
          <p className="job-detail-meta">
            {jobKindLabel(inferJobKind(job))} · {job.status}
            {job.error ? ` · ${job.error}` : ""}
          </p>
        </div>
        <div className="job-detail-actions">
          {job.command && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyCommand()}>
              Copy command
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyLog()}>
            Copy log
          </button>
          {job.status === "done" && job.outputPath && onOpenOutput && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onOpenOutput(job.outputPath)}
            >
              Open output
            </button>
          )}
        </div>
      </div>

      {job.command && (
        <pre className="job-detail-command">{job.command}</pre>
      )}

      <pre className="job-detail-log">
        {job.log.length > 0 ? job.log.join("\n") : "No log output yet."}
      </pre>
    </div>
  );
}
