import type { ImportSource } from "../../shared/project";
import type { PreviewCrashTestResult } from "../../shared/previewCrashTestTypes";
import { runPreviewCrashTest } from "./previewCrashTestRunner";

type PreviewCrashTestDriverOptions = {
  filePath: string;
  importMediaFiles: (paths: string[], source: ImportSource) => Promise<void>;
  getProjectItemsCount: () => number;
  getTimelineLayersCount: () => number;
  getIsPlaying: () => boolean;
};

declare global {
  interface Window {
    __FFMPEG_STUDIO_RUN_PREVIEW_CRASH_TEST__?: () => Promise<PreviewCrashTestResult>;
  }
}

export function exposePreviewCrashTestDriver(options: PreviewCrashTestDriverOptions): void {
  if (!window.ffmpegStudio?.previewCrashTestEnabled) {
    delete window.__FFMPEG_STUDIO_RUN_PREVIEW_CRASH_TEST__;
    return;
  }

  window.__FFMPEG_STUDIO_RUN_PREVIEW_CRASH_TEST__ = () =>
    runPreviewCrashTest({
      filePath: options.filePath,
      importFile: async (filePath: string) => {
        await options.importMediaFiles([filePath], "dialog");
      },
      getProjectItemsCount: options.getProjectItemsCount,
      getTimelineLayersCount: options.getTimelineLayersCount,
      getIsPlaying: options.getIsPlaying,
    });
}

export function clearPreviewCrashTestDriver(): void {
  delete window.__FFMPEG_STUDIO_RUN_PREVIEW_CRASH_TEST__;
}
