import { useCallback, useEffect, useRef } from "react";
import type { FfmpegResolveResult, Job } from "../../shared/types";

type UseBackgroundJobQueueOptions = {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  setIsRunning: (running: boolean) => void;
  setSelectedJobId: (id: string | null) => void;
  setBottomTab: (tab: import("../components/BottomDock").BottomTab) => void;
  ffmpegStatus: FfmpegResolveResult | null;
  refreshFfmpegStatus: () => Promise<FfmpegResolveResult>;
  onJobDone: (job: Job) => void;
  onJobError: (job: Job) => void;
};

export function useBackgroundJobQueue({
  jobs,
  setJobs,
  setIsRunning,
  setSelectedJobId,
  setBottomTab,
  ffmpegStatus,
  refreshFfmpegStatus,
  onJobDone,
  onJobError,
}: UseBackgroundJobQueueOptions) {
  const processedJobIdsRef = useRef<Set<string>>(new Set());

  const attachJobCommand = useCallback(
    async (job: Job): Promise<Job> => {
      const resolved = ffmpegStatus ?? (await refreshFfmpegStatus());
      if (!resolved.ok || !resolved.ffmpegPath) {
        return job;
      }
      const command = await window.ffmpegStudio.getCommandPreview(
        resolved.ffmpegPath,
        job.args
      );
      return { ...job, command };
    },
    [ffmpegStatus, refreshFfmpegStatus]
  );

  const enqueueBackgroundJobs = useCallback(
    async (newJobs: Job[]) => {
      if (newJobs.length === 0) {
        return;
      }

      const withCommands = await Promise.all(newJobs.map(attachJobCommand));
      setJobs((prev) => [...prev, ...withCommands]);
      setSelectedJobId(withCommands[0].id);
      setBottomTab("tasks");
      setIsRunning(true);

      try {
        const result = await window.ffmpegStudio.enqueueJobs(withCommands);
        setJobs((prev) => {
          const map = new Map(result.map((job) => [job.id, job]));
          return prev.map((job) => map.get(job.id) ?? job);
        });
      } finally {
        setIsRunning(false);
      }
    },
    [
      attachJobCommand,
      setBottomTab,
      setIsRunning,
      setJobs,
      setSelectedJobId,
    ]
  );

  const cancelBackgroundJob = useCallback(
    async (jobId: string) => {
      const result = await window.ffmpegStudio.cancelJob(jobId);
      setJobs((prev) => {
        const map = new Map(result.map((job) => [job.id, job]));
        return prev.map((job) => map.get(job.id) ?? job);
      });
    },
    [setJobs]
  );

  useEffect(() => {
    for (const job of jobs) {
      if (processedJobIdsRef.current.has(job.id)) {
        continue;
      }
      if (job.status === "done") {
        processedJobIdsRef.current.add(job.id);
        onJobDone(job);
      } else if (job.status === "error") {
        processedJobIdsRef.current.add(job.id);
        onJobError(job);
      }
    }
  }, [jobs, onJobDone, onJobError]);

  return {
    enqueueBackgroundJobs,
    cancelBackgroundJob,
  };
}
