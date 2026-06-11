import { getBasename } from "../../shared/pathUtils";
import type { Job } from "../../shared/types";
import {
  getJobDisplayTitle,
  inferJobKind,
  jobKindLabel,
  jobStatusClass,
  jobStatusLabel,
} from "../../jobs/jobUtils";

type BackgroundTasksPanelProps = {
  jobs: Job[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onRemoveJob: (jobId: string) => void;
  onOpenOutput: (outputPath: string) => void;
};

export default function BackgroundTasksPanel({
  jobs,
  selectedJobId,
  onSelectJob,
  onCancelJob,
  onRemoveJob,
  onOpenOutput,
}: BackgroundTasksPanelProps) {
  if (jobs.length === 0) {
    return (
      <div className="background-tasks-empty">
        No background tasks yet. Proxy, cache, analysis, and render jobs appear here.
      </div>
    );
  }

  return (
    <div className="background-tasks-wrap">
      <table className="background-tasks-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Type</th>
            <th>Name</th>
            <th>Progress</th>
            <th>Output</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const kind = inferJobKind(job);
            const showProgress = job.status === "running" || job.status === "done";
            const progressValue =
              job.status === "done" ? 100 : job.progress > 0 ? job.progress : 0;
            const indeterminate = job.status === "running" && job.progress === 0;
            const outputLabel = job.outputPath ? getBasename(job.outputPath) : "—";

            return (
              <tr
                key={job.id}
                className={selectedJobId === job.id ? "selected" : ""}
                onClick={() => onSelectJob(job.id)}
              >
                <td>
                  <span className={`status-badge ${jobStatusClass(job.status)}`}>
                    {jobStatusLabel(job.status)}
                  </span>
                </td>
                <td>{jobKindLabel(kind)}</td>
                <td className="cell-name" title={getJobDisplayTitle(job)}>
                  {getJobDisplayTitle(job)}
                </td>
                <td>
                  {showProgress ? (
                    <div className="progress-inline">
                      <div className="progress-bar-track">
                        <div
                          className={`progress-bar-fill ${indeterminate ? "indeterminate" : ""}`}
                          style={{ width: `${progressValue}%` }}
                        />
                      </div>
                      <span className="progress-text">
                        {indeterminate ? "…" : `${Math.round(progressValue)}%`}
                      </span>
                    </div>
                  ) : (
                    <span className="progress-text">—</span>
                  )}
                </td>
                <td className="cell-output" title={job.outputPath}>
                  {outputLabel}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="background-tasks-actions">
                    {job.status === "running" && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onCancelJob(job.id)}
                      >
                        Cancel
                      </button>
                    )}
                    {job.status === "done" && job.outputPath && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onOpenOutput(job.outputPath)}
                      >
                        Open
                      </button>
                    )}
                    {job.status !== "running" && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => onRemoveJob(job.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
