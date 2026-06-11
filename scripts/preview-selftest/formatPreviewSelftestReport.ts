import type { PreviewSelftestResult } from "../../src/shared/previewSelftestTypes.ts";

export function formatPreviewSelftestReport(result: PreviewSelftestResult): string {
  const lines = [
    "PREVIEW SELFTEST REPORT (human-paced visible playback)",
    "",
    `human-paced: ${result.humanPaced ? "yes" : "no"}`,
    `app started: ${result.appStarted ? "yes" : "no"}`,
    `file imported: ${result.fileImported ? "yes" : "no"}`,
    `timeline layer exists: ${result.timelineLayerExists ? "yes" : "no"}`,
    `engine opened: ${result.engineOpened ? "yes" : "no"}`,
    "",
    "Visible frame snapshots (canvas drawCount / lastDrawnTime / checksum):",
    result.initialSnapshot || `initial: checksum=${result.initialChecksum}, drawCount=${result.drawCountInitial}, lastDrawnTime=${result.initialLastDrawnTimeSec ?? "null"}`,
    result.play0SnapshotBefore || `play0-before: drawCount=${result.playDrawCountBefore}, checksum=${result.playChecksumBefore}`,
    result.play0SnapshotAfter || `play0-after: drawCount=${result.playDrawCountAfter}, checksum=${result.playChecksumAfter}`,
    result.seek10Snapshot ||
      `seek10 target=10 actualDrawnTime=${result.seek10ActualDrawnTimeSec?.toFixed(3) ?? "null"}, checksum=${result.seek10Checksum}`,
    result.play10SnapshotBefore || `play10-before: lastDrawnTime=${result.play10LastDrawnTimeBefore ?? "null"}`,
    result.play10SnapshotAfter ||
      `play10-after: lastDrawnTime=${result.play10LastDrawnTimeAfter?.toFixed(3) ?? "null"}, displayDrift=${result.play10DisplayDriftAfter?.toFixed(3) ?? "null"}, queueTimeRange=${result.play10QueueTimeRangeAfter || "n/a"}`,
    result.seek70Snapshot ||
      `seek70 target=70 actualDrawnTime=${result.seek70ActualDrawnTimeSec?.toFixed(3) ?? "null"}, checksum=${result.seek70Checksum}`,
    result.play70SnapshotBefore || `play70-before: lastDrawnTime=${result.play70LastDrawnTimeBefore ?? "null"}`,
    result.play70SnapshotAfter ||
      `play70-after: lastDrawnTime=${result.play70LastDrawnTimeAfter?.toFixed(3) ?? "null"}, displayDrift=${result.play70DisplayDriftAfter?.toFixed(3) ?? "null"}, queueTimeRange=${result.play70QueueTimeRangeAfter || "n/a"}`,
    "",
    `previewBufferedRanges=[${result.previewBufferedRangesSample || "[]"}]`,
    `separated buffer ranges ok: ${result.separatedBufferRangesOk ? "yes" : "no"}`,
    "",
    `paused ok: ${result.pausedOk ? "yes" : "no"}`,
    `visible error: ${result.visibleError ?? "none"}`,
    "",
    "UI verification:",
    `real DOM play button click: ${result.uiPlayButtonVerified ? "yes" : "no"}`,
    `real DOM timeline click: ${result.uiTimelineClickVerified ? "yes" : "no"}`,
    `ui click verified: ${result.uiClickVerified ? "yes" : "no"}`,
    `app crashed: ${result.appCrashed ? "yes" : "no"}`,
  ];

  if (result.failureStage) {
    lines.push(`failure stage: ${result.failureStage}`);
  }
  if (result.failureReason) {
    lines.push(`failure: ${result.failureReason}`);
  }

  lines.push(`result: ${result.pass ? "PASS" : "FAIL"}`);
  return lines.join("\n");
}
