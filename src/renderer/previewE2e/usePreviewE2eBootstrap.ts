import { useEffect } from "react";
import type { ImportSource } from "../../shared/project";
import { augmentPreviewDebugApi } from "./previewE2eDebug";
import { clearPreviewCrashTestDriver, exposePreviewCrashTestDriver } from "./previewCrashTestDriver";
import { clearPreviewSelftestDriver, exposePreviewSelftestDriver } from "./previewSelftestDriver";

type UsePreviewE2eBootstrapOptions = {
  startupReady: boolean;
  importMediaFiles: (paths: string[], source: ImportSource) => Promise<void>;
  getProjectItemsCount: () => number;
  getTimelineLayersCount: () => number;
  getCurrentTime: () => number;
  getIsPlaying: () => boolean;
};

export function usePreviewE2eBootstrap(options: UsePreviewE2eBootstrapOptions): void {
  useEffect(() => {
    const enabled =
      window.ffmpegStudio?.previewSelftestEnabled === true ||
      window.ffmpegStudio?.previewCrashTestEnabled === true;

    if (!enabled || !options.startupReady) {
      clearPreviewSelftestDriver();
      clearPreviewCrashTestDriver();
      return;
    }

    augmentPreviewDebugApi({
      getCurrentTime: options.getCurrentTime,
      getProjectItemsCount: options.getProjectItemsCount,
      getTimelineLayersCount: options.getTimelineLayersCount,
      getIsPlaying: options.getIsPlaying,
    });

    const filePath =
      window.ffmpegStudio.previewCrashTestFile?.trim() ||
      window.ffmpegStudio.previewSelftestFile?.trim() ||
      "";

    if (!filePath) {
      clearPreviewSelftestDriver();
      clearPreviewCrashTestDriver();
      return;
    }

    if (window.ffmpegStudio.previewCrashTestEnabled) {
      exposePreviewCrashTestDriver({
        filePath,
        importMediaFiles: options.importMediaFiles,
        getProjectItemsCount: options.getProjectItemsCount,
        getTimelineLayersCount: options.getTimelineLayersCount,
        getIsPlaying: options.getIsPlaying,
      });
      clearPreviewSelftestDriver();
    } else if (window.ffmpegStudio.previewSelftestEnabled) {
      exposePreviewSelftestDriver({
        filePath,
        importMediaFiles: options.importMediaFiles,
        getProjectItemsCount: options.getProjectItemsCount,
        getTimelineLayersCount: options.getTimelineLayersCount,
        getCurrentTime: options.getCurrentTime,
        getIsPlaying: options.getIsPlaying,
      });
      clearPreviewCrashTestDriver();
    }

    return () => {
      clearPreviewSelftestDriver();
      clearPreviewCrashTestDriver();
    };
  }, [
    options.startupReady,
    options.getCurrentTime,
    options.getIsPlaying,
    options.getProjectItemsCount,
    options.getTimelineLayersCount,
    options.importMediaFiles,
  ]);
}
