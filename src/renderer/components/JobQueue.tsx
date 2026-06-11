import { getBasename } from "../../shared/pathUtils";
import { getPresetById } from "../../presets";
import type { Job } from "../../shared/types";

type JobQueueProps = {
  jobs: Job[];
  isRunning: boolean;
  onStart: () => void;
  onRemove: (jobId: string) => void;
  onOpenOutput: (outputPath: string) => void;
};

function statusText(status: Job["status"]): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "running":
      return "Running";
    case "done":
      return "Done";
    case "error":
      return "Error";
    case "cancelled":
      return "Cancelled";
  }
}

export default function JobQueuePanel({
  jobs,
  isRunning,
  onStart,
  onRemove,
  onOpenOutput,
}: JobQueueProps) {
  const pendingCount = jobs.filter((j) => j.status === "pending").length;

  return (
    <section className="job-queue panel">
      <div className="job-queue-header">
        <h2 className="panel-title">Job Queue</h2>
        <button
          type="button"
          className="btn"
          onClick={onStart}
          disabled={isRunning || pendingCount === 0}
        >
          {isRunning ? "Processing…" : "Start"}
        </button>
      </div>

      {jobs.length === 0 ? (
        <p className="job-queue-empty">No files in queue. Drop videos to get started.</p>
      ) : (
        <div className="job-list">
          {jobs.map((job) => {
            const preset = job.presetId ? getPresetById(job.presetId) : undefined;
            return (
              <article key={job.id} className={`job-card status-${job.status}`}>
                <div className="job-card-main">
                  <div className="job-card-title">{getBasename(job.inputPath)}</div>
                  <div className="job-card-meta">
                    <span>{preset?.title ?? job.presetId}</span>
                    <span className={`job-status status-${job.status}`}>
                      {statusText(job.status)}
                    </span>
                  </div>
                  {(job.status === "running" || job.status === "done") && (
                    <div className="job-progress-wrap">
                      <div
                        className="job-progress-bar"
                        style={{
                          width:
                            job.status === "done"
                              ? "100%"
                              : job.progress > 0
                                ? `${job.progress}%`
                                : "100%",
                          opacity: job.progress > 0 || job.status === "done" ? 1 : 0.35,
                          animation:
                            job.status === "running" && job.progress === 0
                              ? "pulse 1.5s ease-in-out infinite"
                              : undefined,
                        }}
                      />
                    </div>
                  )}
                  {job.status === "running" && job.progress > 0 && (
                    <div className="job-progress-text">
                      {Math.round(job.progress)}%
                    </div>
                  )}
                  {job.error && <div className="job-error">{job.error}</div>}
                  {job.status === "done" && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm job-open-output"
                      onClick={() => onOpenOutput(job.outputPath)}
                    >
                      Show Output
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => onRemove(job.id)}
                  disabled={job.status === "running"}
                >
                  Remove
                </button>
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        .job-queue-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .job-queue-header .panel-title {
          margin: 0;
        }
        .job-queue-empty {
          margin: 0;
          color: var(--text-secondary);
        }
        .job-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .job-card {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 14px;
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          border: 1px solid var(--border);
        }
        .job-card-main {
          flex: 1;
          min-width: 0;
        }
        .job-card-title {
          font-weight: 600;
          word-break: break-all;
        }
        .job-card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 6px;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        .job-status.status-done {
          color: var(--success);
        }
        .job-status.status-error {
          color: var(--error);
        }
        .job-status.status-running {
          color: var(--accent);
        }
        .job-progress-wrap {
          margin-top: 10px;
          height: 6px;
          background: var(--bg-primary);
          border-radius: 999px;
          overflow: hidden;
        }
        .job-progress-bar {
          height: 100%;
          background: var(--accent);
          border-radius: 999px;
          transition: width 0.2s ease;
        }
        .job-progress-text {
          margin-top: 4px;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .job-error {
          margin-top: 8px;
          color: var(--error);
          font-size: 0.85rem;
        }
        .job-open-output {
          margin-top: 10px;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </section>
  );
}
