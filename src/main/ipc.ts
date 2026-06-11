import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { app, ipcMain, BrowserWindow, dialog, shell } from "electron";
import { resolveFfmpeg } from "../ffmpeg/ffmpegResolver";
import { probeMediaFile } from "../ffmpeg/ffprobeRunner";
import {
  getFfmpegFilterHelp,
  hasAllFfmpegFilters,
  hasFfmpegFilter,
  listFfmpegFilters,
} from "../ffmpeg/filterProbe";
import { formatCommandPreview, runFfmpegAndWait } from "../ffmpeg/ffmpegRunner";
import { getVidstabTrfPath, runVidstabAnalysis } from "../ffmpeg/vidstabAnalysis";
import type { LayerEffect } from "../shared/effects";
import {
  getPrecompRenderCachePath,
  getPreviewCachePath,
  getPreviewProxyPath,
} from "./appPaths";
import { buildPreviewProxyArgs } from "../ffmpeg/previewProxyBuilder";
import { runFfmpegThumbnailPipe } from "../ffmpeg/thumbnailPipeRunner";
import {
  checkMediaPathsExist,
  deleteMediaPaths,
  getMediaFileStats,
  clearAutosave,
  loadAutosave,
  loadProjectFromFile,
  saveAutosave,
  saveProjectToFile,
} from "../project/projectStore";
import { loadSettings, saveSettings } from "../settings/settingsStore";
import { previewService } from "../preview/PreviewService";
import { previewEngineHost } from "../preview-engine/PreviewEngineHost";
import { JobQueue } from "../jobs/jobQueue";
import type { FFmpegStudioProject } from "../shared/projectDocument";
import type { PreviewE2eResult } from "../shared/previewE2eTypes";
import type { Job, Settings } from "../shared/types";

const PROJECT_FILTER = {
  name: "FFmpeg Studio Project",
  extensions: ["ffstudio"],
};

function parseCrashTestCycles(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return 10;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 10;
  }
  return parsed;
}

let mainWindow: BrowserWindow | null = null;
let jobQueue: JobQueue;

function sendToRenderer(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  mainWindow = getWindow();

  jobQueue = new JobQueue({
    onLog: (jobId, line) => {
      sendToRenderer("job:log", { jobId, line });
    },
    onProgress: (jobId, progress, indeterminate) => {
      sendToRenderer("job:progress", { jobId, progress, indeterminate });
    },
    onStatusChange: (jobId, status, error) => {
      sendToRenderer("job:status", { jobId, status, error });
    },
  });

  ipcMain.handle("ffmpeg:resolve", async () => {
    const settings = loadSettings();
    return resolveFfmpeg(settings);
  });

  ipcMain.handle("ffmpeg:test", async (_event, settings: Settings) => {
    return resolveFfmpeg(settings);
  });

  ipcMain.handle("ffmpeg:probe", async (_event, filePath: string) => {
    const settings = loadSettings();
    const resolved = await resolveFfmpeg(settings);
    if (!resolved.ok || !resolved.ffprobePath) {
      throw new Error(resolved.error ?? "FFprobe not available");
    }
    return probeMediaFile(resolved.ffprobePath, filePath);
  });

  ipcMain.handle(
    "ffmpeg:createPreviewProxy",
    async (_event, inputPath: string, projectItemId: string) => {
      const settings = loadSettings();
      const resolved = await resolveFfmpeg(settings);
      if (!resolved.ok || !resolved.ffmpegPath) {
        throw new Error(resolved.error ?? "FFmpeg not available");
      }

      const proxyDir = join(app.getPath("userData"), "proxies");
      mkdirSync(proxyDir, { recursive: true });
      const proxyPath = join(proxyDir, `${projectItemId}_preview_proxy.mp4`);
      const args = buildPreviewProxyArgs(inputPath, proxyPath);
      const result = await runFfmpegAndWait({
        ffmpegPath: resolved.ffmpegPath,
        args,
      });

      if (result.code !== 0) {
        const tail = result.logs.slice(-6).join(" ");
        throw new Error(
          tail ? `Proxy generation failed: ${tail}` : "Proxy generation failed"
        );
      }

      return { proxyPath };
    }
  );

  ipcMain.handle(
    "ffmpeg:createPreviewCache",
    async (_event, cacheId: string, args: string[]) => {
      const settings = loadSettings();
      const resolved = await resolveFfmpeg(settings);
      if (!resolved.ok || !resolved.ffmpegPath) {
        throw new Error(resolved.error ?? "FFmpeg not available");
      }

      const cacheDir = join(app.getPath("userData"), "preview-cache");
      mkdirSync(cacheDir, { recursive: true });
      const cachePath = join(cacheDir, `${cacheId}_preview_cache.mp4`);
      const finalArgs =
        args.length > 0
          ? [...args.slice(0, -1), cachePath]
          : args;
      const result = await runFfmpegAndWait({
        ffmpegPath: resolved.ffmpegPath,
        args: finalArgs,
      });

      if (result.code !== 0) {
        const tail = result.logs.slice(-6).join(" ");
        throw new Error(
          tail ? `Preview cache failed: ${tail}` : "Preview cache failed"
        );
      }

      return { cachePath };
    }
  );

  ipcMain.handle("settings:get", () => {
    return loadSettings();
  });

  ipcMain.handle("settings:save", (_event, settings: Settings) => {
    saveSettings(settings);
    return loadSettings();
  });

  ipcMain.handle("preview:open", async (_event, filePath: string) => {
    try {
      return await previewService.open(filePath, "node-av");
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("preview:close", async () => {
    try {
      return await previewService.close();
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("preview:getMetadata", () => {
    try {
      const metadata = previewService.getMetadata();
      return { ok: Boolean(metadata), metadata: metadata ?? undefined };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("preview:seek", async (_event, timeSec: number) => {
    try {
      return await previewService.seek(timeSec);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("preview:decodeFrame", async (_event, timeSec: number) => {
    try {
      const result = await previewService.decodeFrameAt(timeSec);
      if (!result.ok) {
        return result;
      }
      return {
        ...result,
        rgba: result.rgba ? Buffer.from(result.rgba) : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        width: 0,
        height: 0,
        sourceTimeSec: timeSec,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("previewEngine:open", async (_event, filePath: string) => {
    try {
      return await previewEngineHost.open(filePath);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("previewEngine:close", async () => {
    try {
      return await previewEngineHost.close();
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("previewEngine:play", (_event, sourceTime?: number) => {
    try {
      return previewEngineHost.play(sourceTime);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("previewEngine:pause", () => {
    try {
      return previewEngineHost.pause();
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("previewEngine:seek", async (_event, timeSec: number) => {
    try {
      return await previewEngineHost.seek(timeSec);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("previewEngine:getState", () => {
    try {
      return previewEngineHost.getState();
    } catch (error) {
      return {
        ok: false,
        playheadSec: 0,
        isPlaying: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("previewEngine:pollFrame", () => {
    try {
      const result = previewEngineHost.pollFrame();
      if (!result.ok || !result.rgba) {
        return result;
      }
      return {
        ...result,
        rgba: Uint8Array.from(result.rgba),
      };
    } catch (error) {
      return {
        ok: false,
        width: 0,
        height: 0,
        timeSec: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("dialog:openFiles", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Video Files",
          extensions: ["mp4", "mkv", "mov", "avi", "webm", "flv", "wmv", "m4v"],
        },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("shell:openOutputFolder", (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle("ffmpeg:thumbnailDebugPipe", async (_event, inputPath: string) => {
    const settings = loadSettings();
    const resolved = await resolveFfmpeg(settings);
    if (!resolved.ok || !resolved.ffmpegPath) {
      throw new Error(resolved.error ?? "FFmpeg not available");
    }
    if (!existsSync(inputPath)) {
      throw new Error("Input file not found");
    }

    const { data } = await runFfmpegThumbnailPipe(resolved.ffmpegPath, inputPath, 0);
    const dataUrl = `data:image/jpeg;base64,${data.toString("base64")}`;
    return { dataUrl, byteLength: data.length };
  });

  ipcMain.handle(
    "ffmpeg:thumbnailAtTime",
    async (_event, inputPath: string, timeSec: number) => {
      const settings = loadSettings();
      const resolved = await resolveFfmpeg(settings);
      if (!resolved.ok || !resolved.ffmpegPath) {
        throw new Error(resolved.error ?? "FFmpeg not available");
      }
      if (!existsSync(inputPath)) {
        throw new Error("Input file not found");
      }

      const { data } = await runFfmpegThumbnailPipe(
        resolved.ffmpegPath,
        inputPath,
        timeSec
      );
      const dataUrl = `data:image/jpeg;base64,${data.toString("base64")}`;
      return { dataUrl, byteLength: data.length };
    }
  );

  ipcMain.handle("dialog:chooseOutputFolder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle("ffmpeg:commandPreview", (_event, ffmpegPath: string, args: string[]) => {
    return formatCommandPreview(ffmpegPath, args);
  });

  ipcMain.handle("ffmpeg:listFilters", async () => {
    const settings = loadSettings();
    const resolved = await resolveFfmpeg(settings);
    if (!resolved.ok || !resolved.ffmpegPath) {
      throw new Error(resolved.error ?? "FFmpeg not available");
    }
    return listFfmpegFilters(resolved.ffmpegPath);
  });

  ipcMain.handle("ffmpeg:hasFilter", async (_event, filterName: string) => {
    const settings = loadSettings();
    const resolved = await resolveFfmpeg(settings);
    if (!resolved.ok || !resolved.ffmpegPath) {
      return false;
    }
    return hasFfmpegFilter(resolved.ffmpegPath, filterName);
  });

  ipcMain.handle("ffmpeg:hasFilters", async (_event, filterNames: string[]) => {
    const settings = loadSettings();
    const resolved = await resolveFfmpeg(settings);
    if (!resolved.ok || !resolved.ffmpegPath) {
      return false;
    }
    return hasAllFfmpegFilters(resolved.ffmpegPath, filterNames);
  });

  ipcMain.handle("ffmpeg:getFilterHelp", async (_event, filterName: string) => {
    const settings = loadSettings();
    const resolved = await resolveFfmpeg(settings);
    if (!resolved.ok || !resolved.ffmpegPath) {
      throw new Error(resolved.error ?? "FFmpeg not available");
    }
    return getFfmpegFilterHelp(resolved.ffmpegPath, filterName);
  });

  ipcMain.handle(
    "ffmpeg:getVidstabTrfPath",
    (_event, layerId: string, effectId: string) => {
      return getVidstabTrfPath(layerId, effectId);
    }
  );

  ipcMain.handle(
    "ffmpeg:runVidstabAnalysis",
    async (
      _event,
      inputPath: string,
      layerId: string,
      effect: LayerEffect
    ) => {
      const settings = loadSettings();
      const resolved = await resolveFfmpeg(settings);
      if (!resolved.ok || !resolved.ffmpegPath) {
        throw new Error(resolved.error ?? "FFmpeg not available");
      }
      return runVidstabAnalysis({
        ffmpegPath: resolved.ffmpegPath,
        inputPath,
        layerId,
        effect,
      });
    }
  );

  ipcMain.handle("path:toFileUrl", (_event, filePath: string) => {
    return pathToFileURL(filePath).href;
  });

  ipcMain.handle("jobs:get", () => {
    return jobQueue.getJobs();
  });

  ipcMain.handle("jobs:set", (_event, jobs: Job[]) => {
    jobQueue.setJobs(jobs);
    return jobQueue.getJobs();
  });

  ipcMain.handle("jobs:add", (_event, job: Job) => {
    jobQueue.addJob(job);
    return jobQueue.getJobs();
  });

  ipcMain.handle("jobs:remove", (_event, jobId: string) => {
    jobQueue.removeJob(jobId);
    return jobQueue.getJobs();
  });

  ipcMain.handle("jobs:cancel", (_event, jobId: string) => {
    jobQueue.cancelJob(jobId);
    return jobQueue.getJobs();
  });

  ipcMain.handle("paths:previewProxy", (_event, projectItemId: string) => {
    return getPreviewProxyPath(projectItemId);
  });

  ipcMain.handle("paths:previewCache", (_event, cacheId: string) => {
    return getPreviewCachePath(cacheId);
  });

  ipcMain.handle(
    "paths:precompRenderCache",
    (_event, renderJobId: string, precompLayerId: string) => {
      return getPrecompRenderCachePath(renderJobId, precompLayerId);
    }
  );

  ipcMain.handle("project:save", (_event, filePath: string, project: FFmpegStudioProject) => {
    saveProjectToFile(filePath, project);
    return { ok: true, filePath };
  });

  ipcMain.handle("project:load", (_event, filePath: string) => {
    return loadProjectFromFile(filePath);
  });

  ipcMain.handle("project:saveAutosave", (_event, project: FFmpegStudioProject) => {
    saveAutosave(project);
    return { ok: true };
  });

  ipcMain.handle("project:loadAutosave", (_event, projectId?: string) => {
    return loadAutosave(projectId);
  });

  ipcMain.handle("project:clearAutosave", (_event, projectId: string) => {
    clearAutosave(projectId);
    return { ok: true };
  });

  ipcMain.handle("project:checkMedia", (_event, paths: string[]) => {
    return checkMediaPathsExist(paths);
  });

  ipcMain.handle("project:mediaStats", (_event, paths: string[]) => {
    return getMediaFileStats(paths);
  });

  ipcMain.handle("project:deleteMediaPaths", (_event, paths: string[]) => {
    return deleteMediaPaths(paths);
  });

  ipcMain.handle("dialog:saveProject", async (_event, defaultPath?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath,
      filters: [PROJECT_FILTER],
    });
    return result.canceled ? null : result.filePath ?? null;
  });

  ipcMain.handle("dialog:openProject", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [PROJECT_FILTER],
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle("dialog:relinkMedia", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Video Files",
          extensions: ["mp4", "mkv", "mov", "avi", "webm", "flv", "wmv", "m4v"],
        },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle(
    "dialog:confirmUnsaved",
    async (_event, message = "Save changes before continuing?") => {
      const result = await dialog.showMessageBox({
        type: "question",
        buttons: ["Save", "Don't Save", "Cancel"],
        defaultId: 0,
        cancelId: 2,
        message,
      });
      if (result.response === 0) {
        return "save";
      }
      if (result.response === 1) {
        return "discard";
      }
      return "cancel";
    }
  );

  ipcMain.handle("dialog:confirmRestoreAutosave", async () => {
    const result = await dialog.showMessageBox({
      type: "question",
      buttons: ["Restore", "Discard"],
      defaultId: 0,
      cancelId: 1,
      message: "Autosaved project found. Restore?",
    });
    return result.response === 0 ? "restore" : "discard";
  });

  ipcMain.handle("app:setTitle", (_event, title: string) => {
    const window = getWindow();
    if (window) {
      window.setTitle(title);
    }
  });

  ipcMain.handle("app:allowClose", () => {
    const window = getWindow();
    if (window) {
      window.destroy();
    }
  });

  ipcMain.on("previewE2e:config", (event) => {
    const selftest = process.env.PREVIEW_SELFTEST === "1";
    const crashTest = process.env.PREVIEW_CRASH_TEST === "1";
    const enabled = process.env.PREVIEW_E2E === "1" || selftest || crashTest;
    const file =
      process.env.PREVIEW_CRASH_TEST_FILE ??
      process.env.PREVIEW_SELFTEST_FILE ??
      process.env.PREVIEW_E2E_FILE ??
      "";
    event.returnValue = {
      enabled,
      file,
      selftest,
      crashTest,
      crashTestCycles: parseCrashTestCycles(process.env.PREVIEW_CRASH_TEST_CYCLES),
    };
    if (crashTest) {
      console.log("[PREVIEW_CRASH_TEST] preload config", file);
    } else if (selftest) {
      console.log("[PREVIEW_SELFTEST] preload config", file);
    } else if (process.env.PREVIEW_E2E === "1") {
      console.log("[PREVIEW_E2E] preload config", file);
    }
  });

  ipcMain.handle("previewE2e:writeResult", (_event, result: PreviewE2eResult) => {
    if (process.env.PREVIEW_E2E !== "1") {
      return { ok: false, error: "Not in preview E2E mode" };
    }
    const outPath = join(process.cwd(), "tmp", "preview-e2e-result.json");
    mkdirSync(join(process.cwd(), "tmp"), { recursive: true });
    writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
    console.log("[PREVIEW_E2E] writeResult", result.pass ? "PASS" : "FAIL", result.failureReason ?? "");
    setTimeout(() => {
      app.exit(result.pass ? 0 : 1);
    }, 50);
    return { ok: true, path: outPath };
  });

  ipcMain.handle("previewE2e:quit", (_event, code = 1) => {
    if (process.env.PREVIEW_E2E !== "1") {
      return { ok: false };
    }
    app.exit(typeof code === "number" ? code : 1);
    return { ok: true };
  });

  ipcMain.handle("jobs:start", async (_event, jobs: Job[]) => {
    return enqueueJobsInternal(jobs);
  });

  ipcMain.handle("jobs:enqueue", async (_event, jobs: Job[]) => {
    return enqueueJobsInternal(jobs);
  });

  async function enqueueJobsInternal(jobs: Job[]): Promise<Job[]> {
    const settings = loadSettings();
    const resolved = await resolveFfmpeg(settings);

    if (!resolved.ok || !resolved.ffmpegPath) {
      throw new Error(resolved.error ?? "FFmpeg not found");
    }

    jobQueue.mergeJobs(jobs);
    jobQueue.setFfmpegPath(resolved.ffmpegPath);
    await jobQueue.start();
    return jobQueue.getJobs();
  }
}

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}
