export type PreviewSelftestResult = {
  file: string;
  appStarted: boolean;
  fileImported: boolean;
  timelineLayerExists: boolean;
  engineOpened: boolean;
  humanPaced: boolean;
  initialChecksum: number;
  drawCountInitial: number;
  initialLastDrawnTimeSec: number | null;
  initialSnapshot: string;
  seek10Checksum: number;
  seek30Checksum: number;
  playDrawCountBefore: number;
  playDrawCountAfter: number;
  playChecksumBefore: number;
  playChecksumAfter: number;
  play0LastDrawnTimeBefore: number | null;
  play0LastDrawnTimeAfter: number | null;
  play0SnapshotBefore: string;
  play0SnapshotAfter: string;
  playFrom10Checksum: number;
  play10LastDrawnTimeBefore: number | null;
  play10LastDrawnTimeAfter: number | null;
  play10DisplayDriftAfter: number | null;
  play10QueueTimeRangeAfter: string;
  play10SnapshotBefore: string;
  play10SnapshotAfter: string;
  seek10Snapshot: string;
  seek10ActualDrawnTimeSec: number | null;
  seek70Checksum: number;
  seek70Snapshot: string;
  seek70ActualDrawnTimeSec: number | null;
  play70LastDrawnTimeBefore: number | null;
  play70LastDrawnTimeAfter: number | null;
  play70DisplayDriftAfter: number | null;
  play70QueueTimeRangeAfter: string;
  play70SnapshotBefore: string;
  play70SnapshotAfter: string;
  engineStateAfterSeek70: string;
  engineStateAfterPlay70: string;
  pausedOk: boolean;
  seekWhilePlaying20Ok: boolean;
  seekWhilePlaying40Ok: boolean;
  unbufferedPlayOk: boolean;
  unbufferedSeekWhilePlayingOk: boolean;
  separatedBufferRangesOk: boolean;
  cacheBarSeparatedRangesOk: boolean;
  previewBufferRangeCount: number;
  previewBufferedRangesSample: string;
  engineStateAfterInitial: string;
  engineStateAfterPlay0: string;
  engineStateAfterPause: string;
  engineStateAfterSeek10: string;
  engineStateAfterPlay10: string;
  audioElementOk: boolean;
  audioPlay10PausedBefore: boolean | null;
  audioPlay10PausedAfter: boolean | null;
  audioPlay10CurrentTimeBefore: number | null;
  audioPlay10CurrentTimeAfter: number | null;
  audioSeek10CurrentTime: number | null;
  audioPauseOk: boolean;
  audioPlay10AdvancesOk: boolean;
  audioSeek10Ok: boolean;
  visibleError: string | null;
  engineStatus: string;
  isPlaying: boolean;
  uiClickVerified: boolean;
  uiPlayButtonVerified: boolean;
  uiTimelineClickVerified: boolean;
  uiPlayheadDragVerified: boolean;
  seekDuringPlayVerified: boolean;
  isPlayingAfterSeek: boolean;
  appCrashed: boolean;
  pass: boolean;
  failureStage?: string;
  failureReason?: string;
  finishedAt: string;
};

export function evaluatePreviewSelftestPass(result: PreviewSelftestResult): boolean {
  const seek10Visible =
    result.seek10Checksum > 0 &&
    result.seek10ActualDrawnTimeSec !== null &&
    Math.abs(result.seek10ActualDrawnTimeSec - 10) <= 1.5;

  const play10Visible =
    result.play10LastDrawnTimeAfter !== null &&
    result.play10LastDrawnTimeBefore !== null &&
    result.play10LastDrawnTimeAfter > result.play10LastDrawnTimeBefore + 0.5 &&
    result.play10LastDrawnTimeAfter > 10.5 &&
    result.playFrom10Checksum > 0 &&
    (result.play10DisplayDriftAfter === null || result.play10DisplayDriftAfter <= 0.75);

  const seek70Visible =
    result.seek70Checksum > 0 &&
    result.seek70ActualDrawnTimeSec !== null &&
    Math.abs(result.seek70ActualDrawnTimeSec - 70) <= 1.5;

  const play70Visible =
    result.play70LastDrawnTimeAfter !== null &&
    result.play70LastDrawnTimeBefore !== null &&
    result.play70LastDrawnTimeAfter > result.play70LastDrawnTimeBefore + 0.5 &&
    result.play70LastDrawnTimeAfter > 70.5 &&
    (result.play70DisplayDriftAfter === null || result.play70DisplayDriftAfter <= 0.75);

  return (
    result.humanPaced &&
    result.appStarted &&
    result.fileImported &&
    result.timelineLayerExists &&
    result.engineOpened &&
    result.initialChecksum > 0 &&
    result.drawCountInitial >= 1 &&
    result.initialLastDrawnTimeSec !== null &&
    result.pausedOk &&
    seek10Visible &&
    play10Visible &&
    seek70Visible &&
    play70Visible &&
    result.separatedBufferRangesOk &&
    result.audioElementOk &&
    result.audioSeek10Ok &&
    result.audioPlay10AdvancesOk &&
    result.audioPauseOk &&
    result.uiPlayButtonVerified &&
    result.uiTimelineClickVerified &&
    !result.visibleError &&
    !result.appCrashed
  );
}
