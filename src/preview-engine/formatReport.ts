import type { PlayerTestReport } from "./types";

export type ResourceSnapshot = {
  memoryRssMb: number;
  memoryHeapMb: number;
  cpuPercentEstimate: number | null;
};

export function formatSpikeReport(
  report: PlayerTestReport,
  resources: ResourceSnapshot
): string {
  const m = report.metrics;
  const meta = m.metadata;
  const avgDecodeMs =
    m.decodedFrames > 0 ? m.decodeMsTotal / m.decodedFrames : 0;
  const queueDepthAvg =
    m.queueDepthSamples > 0 ? m.queueDepthSum / m.queueDepthSamples : 0;
  const actualPlaybackFps =
    m.playbackWallSec > 0 ? m.displayedFrames / m.playbackWallSec : 0;

  const lines = [
    "PREVIEW ENGINE PHASE 1 SPIKE",
    "backend: node-av sequential player",
    "",
    `file: ${m.file}`,
    `duration: ${meta ? `${meta.durationSec.toFixed(3)}s` : "unknown"}`,
    `resolution: ${meta ? `${meta.width}x${meta.height}` : "unknown"}`,
    `fps: ${meta ? meta.fps.toFixed(3) : "unknown"}`,
    `codec: ${meta?.codec ?? "unknown"}`,
    `pixel_format: ${meta?.pixelFormat ?? "unknown"}`,
    "",
    `decoded frames: ${m.decodedFrames}`,
    `displayed frames: ${m.displayedFrames}`,
    `dropped frames: ${m.droppedFrames}`,
    `queue overflow drops: ${m.queueOverflowDrops}`,
    `display underruns: ${m.displayUnderruns}`,
    `average decode ms/frame: ${avgDecodeMs.toFixed(2)}`,
    `max decode ms/frame: ${m.decodeMsMax.toFixed(2)}`,
    `queue depth avg/max: ${queueDepthAvg.toFixed(2)} / ${m.queueDepthMax}`,
    `actual playback fps: ${actualPlaybackFps.toFixed(2)}`,
    `playback wall time: ${m.playbackWallSec.toFixed(2)}s`,
    `seek count: ${m.seekCount}`,
    `demuxer reopen count: ${m.demuxerReopenCount}`,
    `memory rss: ${resources.memoryRssMb.toFixed(1)} MB`,
    `memory heap: ${resources.memoryHeapMb.toFixed(1)} MB`,
    `cpu rough estimate: ${
      resources.cpuPercentEstimate != null
        ? `${resources.cpuPercentEstimate.toFixed(1)}% (1 core avg)`
        : "n/a"
    }`,
    "",
    "tests:",
    `  play 30s: ${report.tests.play30s ? "PASS" : "FAIL"}`,
    `  seek +5s: ${report.tests.seekForward5s ? "PASS" : "FAIL"}`,
    `  seek -5s: ${report.tests.seekBackward5s ? "PASS" : "FAIL"}`,
    `  pause/resume: ${report.tests.pauseResume ? "PASS" : "FAIL"}`,
    "",
    `sequential decode ok: ${m.sequentialDecodeOk ? "yes" : "no"}`,
  ];

  if (m.errors.length > 0) {
    lines.push("", "errors:");
    for (const error of m.errors) {
      lines.push(`  - ${error}`);
    }
  }

  return lines.join("\n");
}
