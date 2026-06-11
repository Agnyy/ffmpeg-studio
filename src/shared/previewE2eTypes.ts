export type PreviewE2eResult = {
  file: string;
  appStarted: boolean;
  imported: boolean;
  engineOpened: boolean;
  firstFrameVisible: boolean;
  firstFrameChecksum: number;
  drawCountAfterOpen: number;
  drawCountAfterPlay: number;
  checksumAfterPlay: number;
  checksumChanged: boolean;
  visibleError: string | null;
  appCrashed: boolean;
  pass: boolean;
  failureReason?: string;
  finishedAt: string;
};

export function evaluatePreviewE2ePass(result: PreviewE2eResult): boolean {
  return (
    result.appStarted &&
    result.imported &&
    result.engineOpened &&
    result.firstFrameVisible &&
    result.firstFrameChecksum > 0 &&
    result.checksumAfterPlay > 0 &&
    result.checksumChanged &&
    !result.visibleError &&
    !result.appCrashed
  );
}
