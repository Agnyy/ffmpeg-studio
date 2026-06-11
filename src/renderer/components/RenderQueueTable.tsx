import { getBasename } from "../../shared/pathUtils";
import { getPresetById } from "../../presets";
import type { Job } from "../../shared/types";

type RenderQueueTableProps = {
  jobs: Job[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onRemove: (jobId: string) => void;
  onOpenOutput: (outputPath: string) => void;
};

function statusClass(status: Job["status"]): string {
  return status;
}

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

export default function RenderQueueTable({
  jobs,
  selectedJobId,
  onSelectJob,
  onRemove,
  onOpenOutput,
}: RenderQueueTableProps) {
  if (jobs.length === 0) {
    return <div className="render-table-empty">No jobs in render queue.</div>;
  }

  return (
    <div className="render-table-wrap">
      <table className="render-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>File</th>
            <th>Preset</th>
            <th>Progress</th>
            <th>Output</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const preset = job.presetId ? getPresetById(job.presetId) : undefined;
            const showProgress = job.status === "running" || job.status === "done";
            const progressValue =
              job.status === "done" ? 100 : job.progress > 0 ? job.progress : 0;
            const indeterminate = job.status === "running" && job.progress === 0;

            return (
              <tr
                key={job.id}
                className={selectedJobId === job.id ? "selected" : ""}
                onClick={() => onSelectJob(job.id)}
              >
                <td>
                  <span className={`status-badge ${statusClass(job.status)}`}>
                    {statusText(job.status)}
                  </span>
                </td>
                <td className="cell-file" title={job.inputPath}>
                  {getBasename(job.inputPath)}
                </td>
                <td>{preset?.title ?? job.presetId}</td>
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
                  {getBasename(job.outputPath)}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {job.status === "done" && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onOpenOutput(job.outputPath)}
                      >
                        Show
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => onRemove(job.id)}
                      disabled={job.status === "running"}
                    >
                      Remove
                    </button>
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
