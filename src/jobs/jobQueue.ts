import { existsSync, statSync } from "fs";
import type { Job, JobStatus } from "../shared/types";
import { runFfmpegJob, type FfmpegJobHandle } from "../ffmpeg/ffmpegRunner";

export type JobQueueEvents = {
  onLog: (jobId: string, line: string) => void;
  onProgress: (jobId: string, progress: number, indeterminate: boolean) => void;
  onStatusChange: (jobId: string, status: JobStatus, error?: string) => void;
};

export class JobQueue {
  private jobs: Job[] = [];
  private running = false;
  private currentHandle: FfmpegJobHandle | null = null;
  private currentJobId: string | null = null;
  private cancelledJobIds = new Set<string>();
  private ffmpegPath = "";
  private events: JobQueueEvents;

  constructor(events: JobQueueEvents) {
    this.events = events;
  }

  setFfmpegPath(ffmpegPath: string): void {
    this.ffmpegPath = ffmpegPath;
  }

  getJobs(): Job[] {
    return this.jobs.map((job) => ({ ...job, log: [...job.log] }));
  }

  mergeJobs(jobs: Job[]): void {
    for (const incoming of jobs) {
      const index = this.jobs.findIndex((job) => job.id === incoming.id);
      if (index >= 0) {
        const existing = this.jobs[index];
        this.jobs[index] = {
          ...existing,
          ...incoming,
          log: incoming.log.length > 0 ? [...incoming.log] : existing.log,
        };
      } else {
        this.jobs.push({ ...incoming, log: [...incoming.log] });
      }
    }
  }

  setJobs(jobs: Job[]): void {
    this.jobs = jobs.map((job) => ({ ...job, log: [...job.log] }));
  }

  addJob(job: Job): void {
    this.jobs.push({ ...job, log: [...job.log] });
  }

  removeJob(jobId: string): void {
    if (this.currentJobId === jobId) {
      this.cancelJob(jobId);
    }
    this.jobs = this.jobs.filter((job) => job.id !== jobId);
  }

  cancelJob(jobId: string): void {
    const job = this.jobs.find((entry) => entry.id === jobId);
    if (!job) {
      return;
    }

    if (job.status === "pending" || job.status === "running") {
      this.cancelledJobIds.add(jobId);
      if (this.currentJobId === jobId) {
        this.currentHandle?.kill();
      } else {
        this.appendLog(jobId, "Cancelled by user");
        this.updateJobStatus(jobId, "cancelled");
      }
    }
  }

  updateJob(jobId: string, patch: Partial<Job>): void {
    this.jobs = this.jobs.map((job) =>
      job.id === jobId ? { ...job, ...patch, log: patch.log ?? job.log } : job
    );
  }

  async start(): Promise<void> {
    if (this.running || !this.ffmpegPath) {
      return;
    }

    this.running = true;

    try {
      while (true) {
        const nextJob = this.jobs.find(
          (job) => job.status === "pending" && !this.cancelledJobIds.has(job.id)
        );
        if (!nextJob) {
          break;
        }

        await this.runSingleJob(nextJob);
      }
    } finally {
      this.running = false;
      this.currentHandle = null;
      this.currentJobId = null;
    }
  }

  private updateJobStatus(jobId: string, status: JobStatus, error?: string): void {
    const finishedAt =
      status === "done" || status === "error" || status === "cancelled"
        ? new Date().toISOString()
        : undefined;
    this.jobs = this.jobs.map((job) =>
      job.id === jobId
        ? {
            ...job,
            status,
            error,
            finishedAt: finishedAt ?? job.finishedAt,
          }
        : job
    );
    this.events.onStatusChange(jobId, status, error);
  }

  private appendLog(jobId: string, line: string): void {
    this.jobs = this.jobs.map((job) =>
      job.id === jobId ? { ...job, log: [...job.log, line] } : job
    );
    this.events.onLog(jobId, line);
  }

  private setProgress(
    jobId: string,
    progress: number,
    indeterminate: boolean
  ): void {
    if (!indeterminate) {
      this.jobs = this.jobs.map((job) =>
        job.id === jobId ? { ...job, progress } : job
      );
    }
    this.events.onProgress(jobId, progress, indeterminate);
  }

  private verifyOutputFile(job: Job): { ok: boolean; error?: string } {
    if (!existsSync(job.outputPath)) {
      return { ok: false, error: "Output file does not exist" };
    }
    const sizeBytes = statSync(job.outputPath).size;
    if (sizeBytes <= 0) {
      return { ok: false, error: "Output file is empty" };
    }
    return { ok: true };
  }

  private runSingleJob(job: Job): Promise<void> {
    return new Promise((resolve) => {
      this.currentJobId = job.id;
      const startedAt = new Date().toISOString();
      this.jobs = this.jobs.map((entry) =>
        entry.id === job.id ? { ...entry, startedAt, status: "running" } : entry
      );
      this.updateJobStatus(job.id, "running");
      this.setProgress(job.id, 0, job.durationSeconds === undefined);

      if (job.jobKind === "proxy") {
        this.appendLog(
          job.id,
          `[PROXY_START] input=${job.inputPath} output=${job.outputPath} args=${job.args.join(" ")}`
        );
      }

      this.currentHandle = runFfmpegJob({
        ffmpegPath: this.ffmpegPath,
        args: job.args,
        durationSeconds: job.durationSeconds,
        onLog: (line) => {
          if (job.jobKind === "proxy" && line.includes("time=")) {
            this.appendLog(job.id, `[PROXY_PROGRESS] ${line.trim()}`);
          }
          this.appendLog(job.id, line);
        },
        onProgress: (progress, indeterminate) => {
          if (job.jobKind === "proxy" && !indeterminate) {
            this.appendLog(job.id, `[PROXY_PROGRESS] progress=${Math.round(progress)}%`);
          }
          this.setProgress(job.id, progress, indeterminate);
        },
        onError: (err) => {
          if (this.cancelledJobIds.has(job.id)) {
            this.appendLog(job.id, "Cancelled by user");
            this.updateJobStatus(job.id, "cancelled");
          } else {
            if (job.jobKind === "proxy") {
              this.appendLog(job.id, `[PROXY_ERROR] ${err.message}`);
            }
            this.updateJobStatus(job.id, "error", err.message);
          }
          this.cancelledJobIds.delete(job.id);
          this.currentJobId = null;
          resolve();
        },
        onDone: (code) => {
          if (this.cancelledJobIds.has(job.id)) {
            this.appendLog(job.id, "Cancelled by user");
            this.updateJobStatus(job.id, "cancelled");
          } else if (code === 0) {
            const verified = this.verifyOutputFile(job);
            if (!verified.ok) {
              const message = verified.error ?? "Output verification failed";
              if (job.jobKind === "proxy") {
                this.appendLog(
                  job.id,
                  `[PROXY_ERROR] ${message} path=${job.outputPath}`
                );
              }
              this.updateJobStatus(job.id, "error", message);
            } else {
              if (job.jobKind === "proxy") {
                const sizeBytes = statSync(job.outputPath).size;
                this.appendLog(
                  job.id,
                  `[PROXY_DONE] output=${job.outputPath} exists=true sizeBytes=${sizeBytes}`
                );
              }
              this.jobs = this.jobs.map((entry) =>
                entry.id === job.id ? { ...entry, progress: 100 } : entry
              );
              this.updateJobStatus(job.id, "done");
            }
          } else {
            const message = `FFmpeg exited with code ${code}`;
            if (job.jobKind === "proxy") {
              this.appendLog(job.id, `[PROXY_ERROR] ${message}`);
            }
            this.updateJobStatus(job.id, "error", message);
          }
          this.cancelledJobIds.delete(job.id);
          this.currentJobId = null;
          resolve();
        },
      });
    });
  }
}
