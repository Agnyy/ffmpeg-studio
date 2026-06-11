export type PreviewCrashTestResult = {
  file: string;
  appStarted: boolean;
  fileImported: boolean;
  timelineLayerExists: boolean;
  engineOpened: boolean;
  initialFrameOk: boolean;
  cyclesCompleted: number;
  cyclesRequested: number;
  finalDrawCount: number;
  finalChecksum: number;
  finalLastDrawnTimeSec: number | null;
  playbackAfterStressOk: boolean;
  visibleError: string | null;
  appCrashed: boolean;
  pass: boolean;
  failureStage?: string;
  failureReason?: string;
  finishedAt: string;
};

export function evaluatePreviewCrashTestPass(result: PreviewCrashTestResult): boolean {
  return (
    result.appStarted &&
    result.fileImported &&
    result.timelineLayerExists &&
    result.engineOpened &&
    result.initialFrameOk &&
    result.cyclesCompleted >= result.cyclesRequested &&
    result.finalChecksum > 0 &&
    result.playbackAfterStressOk &&
    !result.visibleError &&
    !result.appCrashed
  );
}
