import type { Job, JobKind, JobStatus } from "../shared/types";
import { getBasename } from "../shared/pathUtils";

export function jobKindLabel(kind: JobKind): string {
  switch (kind) {
    case "render":
      return "Render";
    case "proxy":
      return "Proxy";
    case "preview-cache":
      return "Cache";
    case "analysis":
      return "Analysis";
  }
}

export function jobStatusLabel(status: JobStatus): string {
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

export function jobStatusClass(status: JobStatus): string {
  return status;
}

export function getJobDisplayTitle(job: Job): string {
  return job.title || job.label || getBasename(job.inputPath);
}

export function getRunningJobSummary(jobs: Job[]): string | null {
  const running = jobs.find((job) => job.status === "running");
  if (!running) {
    return null;
  }
  const progress =
    running.progress > 0 ? ` ${Math.round(running.progress)}%` : "";
  return `Running 1 task: ${getJobDisplayTitle(running)}${progress}`;
}

export function inferJobKind(job: Job): JobKind {
  if (job.jobKind) {
    return job.jobKind;
  }
  if (job.presetId === "export-composition" || job.presetId === "edit-clip") {
    return "render";
  }
  if (job.presetId === "analysis-vidstab") {
    return "analysis";
  }
  if (job.presetId === "preview-proxy") {
    return "proxy";
  }
  if (job.presetId === "preview-cache") {
    return "preview-cache";
  }
  return "render";
}
