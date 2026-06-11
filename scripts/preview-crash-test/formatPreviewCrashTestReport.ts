import type { PreviewCrashTestResult } from "../../src/shared/previewCrashTestTypes.ts";

export function formatPreviewCrashTestReport(result: PreviewCrashTestResult): string {
  const lines = [
    "PREVIEW CRASH STRESS TEST REPORT",
    "",
    `file imported: ${result.fileImported ? "yes" : "no"}`,
    `engine opened: ${result.engineOpened ? "yes" : "no"}`,
    `initial frame ok: ${result.initialFrameOk ? "yes" : "no"}`,
    `stress cycles: ${result.cyclesCompleted}/${result.cyclesRequested}`,
    `final drawCount: ${result.finalDrawCount}`,
    `final lastDrawnTime: ${result.finalLastDrawnTimeSec?.toFixed(3) ?? "null"}`,
    `final checksum: ${result.finalChecksum}`,
    `playback after stress ok: ${result.playbackAfterStressOk ? "yes" : "no"}`,
    `visible error: ${result.visibleError ?? "none"}`,
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
