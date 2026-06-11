import type { ImportSource } from "../../shared/project";
import type { PreviewSelftestResult } from "../../shared/previewSelftestTypes";
import { runPreviewSelftest } from "./previewSelftestRunner";

type PreviewSelftestDriverOptions = {
  filePath: string;
  importMediaFiles: (paths: string[], source: ImportSource) => Promise<void>;
  getProjectItemsCount: () => number;
  getTimelineLayersCount: () => number;
  getCurrentTime: () => number;
  getIsPlaying: () => boolean;
};

declare global {
  interface Window {
    __FFMPEG_STUDIO_RUN_PREVIEW_SELFTEST__?: () => Promise<PreviewSelftestResult>;
  }
}

export function exposePreviewSelftestDriver(options: PreviewSelftestDriverOptions): void {
  if (!window.ffmpegStudio?.previewSelftestEnabled) {
    delete window.__FFMPEG_STUDIO_RUN_PREVIEW_SELFTEST__;
    return;
  }

  window.__FFMPEG_STUDIO_RUN_PREVIEW_SELFTEST__ = () =>
    runPreviewSelftest({
      filePath: options.filePath,
      importFile: async (path) => {
        await options.importMediaFiles([path], "dialog");
      },
      getProjectItemsCount: options.getProjectItemsCount,
      getTimelineLayersCount: options.getTimelineLayersCount,
      getCurrentTime: options.getCurrentTime,
      getIsPlaying: options.getIsPlaying,
    });
}

export function clearPreviewSelftestDriver(): void {
  delete window.__FFMPEG_STUDIO_RUN_PREVIEW_SELFTEST__;
}
