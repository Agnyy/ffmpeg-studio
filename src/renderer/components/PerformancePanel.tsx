import { useEffect, useState } from "react";
import type { Job } from "../../shared/types";
import {
  getRenderCounts,
  resetRenderCounts,
  subscribeRenderCounts,
} from "../perf/renderCounts";

const IS_DEV = process.env.NODE_ENV !== "production";

const TRACKED_COMPONENTS = [
  "App",
  "EnginePreviewPanel",
  "TimelineEditor",
  "ProjectPanel",
  "RightDock",
  "EffectsPresetsPanel",
] as const;

type PerformancePanelProps = {
  jobs: Job[];
  timelineLayerCount: number;
  isPlaying: boolean;
};

function formatMemoryMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PerformancePanel({
  jobs,
  timelineLayerCount,
  isPlaying,
}: PerformancePanelProps) {
  const [renderCounts, setRenderCounts] = useState(getRenderCounts);
  const [uiFps, setUiFps] = useState(0);
  const [videoElementCount, setVideoElementCount] = useState(0);

  useEffect(() => {
    return subscribeRenderCounts(() => setRenderCounts(getRenderCounts()));
  }, []);

  useEffect(() => {
    let frameCount = 0;
    let lastSample = performance.now();
    let rafId = 0;

    const sample = (now: number) => {
      frameCount += 1;
      if (now - lastSample >= 1000) {
        setUiFps(Math.round((frameCount * 1000) / (now - lastSample)));
        frameCount = 0;
        lastSample = now;
      }
      rafId = requestAnimationFrame(sample);
    };

    rafId = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const sampleVideos = () => {
      setVideoElementCount(document.querySelectorAll("video").length);
    };
    sampleVideos();
    const intervalId = window.setInterval(sampleVideos, 500);
    return () => window.clearInterval(intervalId);
  }, [isPlaying, timelineLayerCount]);

  if (!IS_DEV) {
    return null;
  }

  const activeJobs = jobs.filter(
    (job) => job.status === "running" || job.status === "pending"
  ).length;

  const memory = (
    performance as Performance & {
      memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    }
  ).memory;

  return (
    <section className="info-panel-section performance-panel">
      <div className="performance-panel-header">
        <h3 className="info-panel-title">Performance (dev)</h3>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            resetRenderCounts();
            setRenderCounts(getRenderCounts());
          }}
        >
          Reset counts
        </button>
      </div>

      <dl className="info-panel-meta performance-panel-meta">
        <div>
          <dt>UI FPS</dt>
          <dd>{uiFps}</dd>
        </div>
        <div>
          <dt>Video elements</dt>
          <dd>{videoElementCount}</dd>
        </div>
        <div>
          <dt>Active jobs</dt>
          <dd>{activeJobs}</dd>
        </div>
        <div>
          <dt>Timeline layers</dt>
          <dd>{timelineLayerCount}</dd>
        </div>
        <div>
          <dt>Playback</dt>
          <dd>{isPlaying ? "playing" : "stopped"}</dd>
        </div>
        {memory && (
          <>
            <div>
              <dt>JS heap used</dt>
              <dd>{formatMemoryMb(memory.usedJSHeapSize)}</dd>
            </div>
            <div>
              <dt>JS heap limit</dt>
              <dd>{formatMemoryMb(memory.jsHeapSizeLimit)}</dd>
            </div>
          </>
        )}
      </dl>

      <h4 className="performance-panel-subtitle">React render counts</h4>
      <dl className="info-panel-meta performance-panel-meta">
        {TRACKED_COMPONENTS.map((name) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{renderCounts[name] ?? 0}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
