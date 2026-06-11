import { contextBridge, ipcRenderer, webUtils, IpcRendererEvent } from "electron";
import { pathToFileURL } from "url";
import type { FFmpegStudioProject } from "../shared/projectDocument";
import type { LayerEffect } from "../shared/effects";
import type {
  PreviewCloseResult,
  PreviewFrameResult,
  PreviewOpenResult,
  PreviewSeekResult,
} from "../preview/types";
import type {
  PreviewEngineCloseResult,
  PreviewEngineFrameResult,
  PreviewEngineOpenResult,
  PreviewEngineSeekResult,
  PreviewEngineStateResult,
} from "../preview-engine/ipcTypes";
import type { PreviewE2eResult } from "../shared/previewE2eTypes";
import type {
  FfmpegFilterInfo,
  FfmpegResolveResult,
  Job,
  JobLogEvent,
  JobProgressEvent,
  JobStatusEvent,
  MediaInfo,
  Settings,
} from "../shared/types";
import type { MenuAction } from "./menu";

function toFileUrl(filePath: string): string {
  return pathToFileURL(filePath).href;
}

function readPreviewE2eConfig(): {
  enabled: boolean;
  file: string;
  selftest: boolean;
  crashTest: boolean;
  crashTestCycles: number;
} {
  try {
    const fromMain = ipcRenderer.sendSync("previewE2e:config") as {
      enabled: boolean;
      file: string;
      selftest?: boolean;
      crashTest?: boolean;
      crashTestCycles?: number;
    };
    if (fromMain.enabled) {
      return {
        enabled: true,
        file: fromMain.file,
        selftest: fromMain.selftest === true,
        crashTest: fromMain.crashTest === true,
        crashTestCycles:
          typeof fromMain.crashTestCycles === "number" ? fromMain.crashTestCycles : 10,
      };
    }
  } catch {
    // fall through to argv
  }

  const argv = process.argv;
  const argvSelftest = argv.includes("--preview-selftest");
  const argvCrashTest = argv.includes("--preview-crash-test");
  const argvEnabled = argv.includes("--preview-e2e") || argvSelftest || argvCrashTest;
  const fileArg = argv.find((arg) => arg.startsWith("--preview-e2e-file="));
  const selftestFileArg = argv.find((arg) => arg.startsWith("--preview-selftest-file="));
  const crashTestFileArg = argv.find((arg) => arg.startsWith("--preview-crash-test-file="));
  const argvFile = crashTestFileArg
    ? crashTestFileArg.slice("--preview-crash-test-file=".length)
    : selftestFileArg
      ? selftestFileArg.slice("--preview-selftest-file=".length)
      : fileArg
        ? fileArg.slice("--preview-e2e-file=".length)
        : "";

  if (argvEnabled) {
    return {
      enabled: true,
      file: argvFile,
      selftest: argvSelftest,
      crashTest: argvCrashTest,
      crashTestCycles: 10,
    };
  }

  return { enabled: false, file: "", selftest: false, crashTest: false, crashTestCycles: 10 };
}

const previewE2eConfig = readPreviewE2eConfig();
if (previewE2eConfig.selftest) {
  console.log("[PREVIEW_SELFTEST] preload enabled", previewE2eConfig.file || "(no file)");
} else if (previewE2eConfig.enabled) {
  console.log("[PREVIEW_E2E] preload enabled", previewE2eConfig.file || "(no file)");
}

export type FfmpegStudioApi = {
  resolveFfmpeg: () => Promise<FfmpegResolveResult>;
  testFfmpeg: (settings: Settings) => Promise<FfmpegResolveResult>;
  probeFile: (filePath: string) => Promise<MediaInfo>;
  createPreviewProxy: (
    inputPath: string,
    projectItemId: string
  ) => Promise<{ proxyPath: string }>;
  createPreviewCache: (cacheId: string, args: string[]) => Promise<{ cachePath: string }>;
  runJob: (jobs: Job[]) => Promise<Job[]>;
  enqueueJobs: (jobs: Job[]) => Promise<Job[]>;
  cancelJob: (jobId: string) => Promise<Job[]>;
  resolvePreviewProxyPath: (projectItemId: string) => Promise<string>;
  resolvePreviewCachePath: (cacheId: string) => Promise<string>;
  resolvePrecompRenderCachePath: (
    renderJobId: string,
    precompLayerId: string
  ) => Promise<string>;
  getJobs: () => Promise<Job[]>;
  setJobs: (jobs: Job[]) => Promise<Job[]>;
  addJob: (job: Job) => Promise<Job[]>;
  removeJob: (jobId: string) => Promise<Job[]>;
  openFileDialog: () => Promise<string[]>;
  openOutputFolder: (filePath: string) => Promise<void>;
  chooseOutputFolder: () => Promise<string | null>;
  thumbnailDebugPipe: (
    inputPath: string
  ) => Promise<{ dataUrl: string; byteLength: number }>;
  thumbnailAtTime: (
    inputPath: string,
    timeSec: number
  ) => Promise<{ dataUrl: string; byteLength: number }>;
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<Settings>;
  previewOpen: (filePath: string) => Promise<PreviewOpenResult>;
  previewClose: () => Promise<PreviewCloseResult>;
  previewSeek: (timeSec: number) => Promise<PreviewSeekResult>;
  previewDecodeFrame: (timeSec: number) => Promise<PreviewFrameResult>;
  previewEngineOpen: (filePath: string) => Promise<PreviewEngineOpenResult>;
  previewEngineClose: () => Promise<PreviewEngineCloseResult>;
  previewEnginePlay: (sourceTime?: number) => Promise<PreviewEngineSeekResult>;
  previewEnginePause: () => Promise<PreviewEngineSeekResult>;
  previewEngineSeek: (timeSec: number) => Promise<PreviewEngineSeekResult>;
  previewEngineGetState: () => Promise<PreviewEngineStateResult>;
  previewEnginePollFrame: () => Promise<PreviewEngineFrameResult>;
  previewE2eEnabled: boolean;
  previewE2eFile: string;
  previewSelftestEnabled: boolean;
  previewSelftestFile: string;
  previewCrashTestEnabled: boolean;
  previewCrashTestFile: string;
  previewCrashTestCycles: number;
  previewE2eWriteResult: (result: PreviewE2eResult) => Promise<{ ok: boolean; path?: string; error?: string }>;
  previewE2eQuit: (code?: number) => Promise<{ ok: boolean }>;
  onPreviewE2eBootstrap: (callback: (payload: { file: string }) => void) => () => void;
  getCommandPreview: (ffmpegPath: string, args: string[]) => Promise<string>;
  listFfmpegFilters: () => Promise<FfmpegFilterInfo[]>;
  hasFfmpegFilter: (filterName: string) => Promise<boolean>;
  hasFfmpegFilters: (filterNames: string[]) => Promise<boolean>;
  getFfmpegFilterHelp: (filterName: string) => Promise<string>;
  getVidstabTrfPath: (layerId: string, effectId: string) => Promise<string>;
  runVidstabAnalysis: (
    inputPath: string,
    layerId: string,
    effect: LayerEffect
  ) => Promise<{ trfPath: string; logs: string[] }>;
  getPathForFile: (file: File) => string;
  toFileUrl: (filePath: string) => string;
  pathToFileUrl: (filePath: string) => string;
  saveProject: (filePath: string, project: FFmpegStudioProject) => Promise<{ ok: boolean; filePath: string }>;
  loadProjectFromPath: (filePath: string) => Promise<FFmpegStudioProject>;
  saveProjectDialog: (defaultPath?: string) => Promise<string | null>;
  openProjectDialog: () => Promise<string | null>;
  saveAutosave: (project: FFmpegStudioProject) => Promise<{ ok: boolean }>;
  loadAutosave: (projectId?: string) => Promise<FFmpegStudioProject | null>;
  clearAutosave: (projectId: string) => Promise<{ ok: boolean }>;
  checkMediaPaths: (paths: string[]) => Promise<Record<string, boolean>>;
  getMediaFileStats: (
    paths: string[]
  ) => Promise<Record<string, { exists: boolean; sizeBytes: number }>>;
  deleteMediaPaths: (
    paths: string[]
  ) => Promise<{ deleted: string[]; failed: string[] }>;
  relinkMediaDialog: () => Promise<string | null>;
  confirmUnsaved: (message?: string) => Promise<"save" | "discard" | "cancel">;
  confirmRestoreAutosave: () => Promise<"restore" | "discard">;
  setWindowTitle: (title: string) => Promise<void>;
  allowClose: () => Promise<void>;
  onBeforeClose: (callback: () => void) => () => void;
  onMenuAction: (callback: (action: MenuAction) => void) => () => void;
  onJobLog: (callback: (event: JobLogEvent) => void) => () => void;
  onJobProgress: (callback: (event: JobProgressEvent) => void) => () => void;
  onJobStatus: (callback: (event: JobStatusEvent) => void) => () => void;
};

const api: FfmpegStudioApi = {
  resolveFfmpeg: () => ipcRenderer.invoke("ffmpeg:resolve"),
  testFfmpeg: (settings) => ipcRenderer.invoke("ffmpeg:test", settings),
  probeFile: (filePath) => ipcRenderer.invoke("ffmpeg:probe", filePath),
  createPreviewProxy: (inputPath, projectItemId) =>
    ipcRenderer.invoke("ffmpeg:createPreviewProxy", inputPath, projectItemId),
  createPreviewCache: (cacheId, args) =>
    ipcRenderer.invoke("ffmpeg:createPreviewCache", cacheId, args),
  runJob: (jobs) => ipcRenderer.invoke("jobs:start", jobs),
  enqueueJobs: (jobs) => ipcRenderer.invoke("jobs:enqueue", jobs),
  cancelJob: (jobId) => ipcRenderer.invoke("jobs:cancel", jobId),
  resolvePreviewProxyPath: (projectItemId) =>
    ipcRenderer.invoke("paths:previewProxy", projectItemId),
  resolvePreviewCachePath: (cacheId) =>
    ipcRenderer.invoke("paths:previewCache", cacheId),
  resolvePrecompRenderCachePath: (renderJobId, precompLayerId) =>
    ipcRenderer.invoke("paths:precompRenderCache", renderJobId, precompLayerId),
  getJobs: () => ipcRenderer.invoke("jobs:get"),
  setJobs: (jobs) => ipcRenderer.invoke("jobs:set", jobs),
  addJob: (job) => ipcRenderer.invoke("jobs:add", job),
  removeJob: (jobId) => ipcRenderer.invoke("jobs:remove", jobId),
  openFileDialog: () => ipcRenderer.invoke("dialog:openFiles"),
  openOutputFolder: (filePath) =>
    ipcRenderer.invoke("shell:openOutputFolder", filePath),
  chooseOutputFolder: () => ipcRenderer.invoke("dialog:chooseOutputFolder"),
  thumbnailDebugPipe: (inputPath) =>
    ipcRenderer.invoke("ffmpeg:thumbnailDebugPipe", inputPath),
  thumbnailAtTime: (inputPath, timeSec) =>
    ipcRenderer.invoke("ffmpeg:thumbnailAtTime", inputPath, timeSec),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  previewOpen: (filePath) => ipcRenderer.invoke("preview:open", filePath),
  previewClose: () => ipcRenderer.invoke("preview:close"),
  previewSeek: (timeSec) => ipcRenderer.invoke("preview:seek", timeSec),
  previewDecodeFrame: (timeSec) => ipcRenderer.invoke("preview:decodeFrame", timeSec),
  previewEngineOpen: (filePath) => ipcRenderer.invoke("previewEngine:open", filePath),
  previewEngineClose: () => ipcRenderer.invoke("previewEngine:close"),
  previewEnginePlay: (sourceTime?: number) =>
    ipcRenderer.invoke("previewEngine:play", sourceTime),
  previewEnginePause: () => ipcRenderer.invoke("previewEngine:pause"),
  previewEngineSeek: (timeSec) => ipcRenderer.invoke("previewEngine:seek", timeSec),
  previewEngineGetState: () => ipcRenderer.invoke("previewEngine:getState"),
  previewEnginePollFrame: () => ipcRenderer.invoke("previewEngine:pollFrame"),
  previewE2eEnabled: previewE2eConfig.enabled,
  previewE2eFile: previewE2eConfig.file,
  previewSelftestEnabled: previewE2eConfig.selftest,
  previewSelftestFile: previewE2eConfig.selftest ? previewE2eConfig.file : "",
  previewCrashTestEnabled: previewE2eConfig.crashTest === true,
  previewCrashTestFile: previewE2eConfig.crashTest ? previewE2eConfig.file : "",
  previewCrashTestCycles: previewE2eConfig.crashTest ? previewE2eConfig.crashTestCycles : 10,
  previewE2eWriteResult: (result) => ipcRenderer.invoke("previewE2e:writeResult", result),
  previewE2eQuit: (code) => ipcRenderer.invoke("previewE2e:quit", code),
  onPreviewE2eBootstrap: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: { file: string }) => callback(payload);
    ipcRenderer.on("previewE2e:bootstrap", listener);
    return () => ipcRenderer.removeListener("previewE2e:bootstrap", listener);
  },
  getCommandPreview: (ffmpegPath, args) =>
    ipcRenderer.invoke("ffmpeg:commandPreview", ffmpegPath, args),
  listFfmpegFilters: () => ipcRenderer.invoke("ffmpeg:listFilters"),
  hasFfmpegFilter: (filterName) => ipcRenderer.invoke("ffmpeg:hasFilter", filterName),
  hasFfmpegFilters: (filterNames) =>
    ipcRenderer.invoke("ffmpeg:hasFilters", filterNames),
  getFfmpegFilterHelp: (filterName) =>
    ipcRenderer.invoke("ffmpeg:getFilterHelp", filterName),
  getVidstabTrfPath: (layerId, effectId) =>
    ipcRenderer.invoke("ffmpeg:getVidstabTrfPath", layerId, effectId),
  runVidstabAnalysis: (inputPath, layerId, effect) =>
    ipcRenderer.invoke("ffmpeg:runVidstabAnalysis", inputPath, layerId, effect),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  toFileUrl: (filePath) => toFileUrl(filePath),
  pathToFileUrl: (filePath) => toFileUrl(filePath),
  saveProject: (filePath, project) =>
    ipcRenderer.invoke("project:save", filePath, project),
  loadProjectFromPath: (filePath) => ipcRenderer.invoke("project:load", filePath),
  saveProjectDialog: (defaultPath) =>
    ipcRenderer.invoke("dialog:saveProject", defaultPath),
  openProjectDialog: () => ipcRenderer.invoke("dialog:openProject"),
  saveAutosave: (project) => ipcRenderer.invoke("project:saveAutosave", project),
  loadAutosave: (projectId) => ipcRenderer.invoke("project:loadAutosave", projectId),
  clearAutosave: (projectId) => ipcRenderer.invoke("project:clearAutosave", projectId),
  checkMediaPaths: (paths) => ipcRenderer.invoke("project:checkMedia", paths),
  getMediaFileStats: (paths) => ipcRenderer.invoke("project:mediaStats", paths),
  deleteMediaPaths: (paths) => ipcRenderer.invoke("project:deleteMediaPaths", paths),
  relinkMediaDialog: () => ipcRenderer.invoke("dialog:relinkMedia"),
  confirmUnsaved: (message) => ipcRenderer.invoke("dialog:confirmUnsaved", message),
  confirmRestoreAutosave: () => ipcRenderer.invoke("dialog:confirmRestoreAutosave"),
  setWindowTitle: (title) => ipcRenderer.invoke("app:setTitle", title),
  allowClose: () => ipcRenderer.invoke("app:allowClose"),
  onBeforeClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app:beforeClose", listener);
    return () => ipcRenderer.removeListener("app:beforeClose", listener);
  },
  onMenuAction: (callback) => {
    const listener = (_event: IpcRendererEvent, action: MenuAction) => callback(action);
    ipcRenderer.on("menu:action", listener);
    return () => ipcRenderer.removeListener("menu:action", listener);
  },
  onJobLog: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: JobLogEvent) =>
      callback(payload);
    ipcRenderer.on("job:log", listener);
    return () => ipcRenderer.removeListener("job:log", listener);
  },
  onJobProgress: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: JobProgressEvent) =>
      callback(payload);
    ipcRenderer.on("job:progress", listener);
    return () => ipcRenderer.removeListener("job:progress", listener);
  },
  onJobStatus: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: JobStatusEvent) =>
      callback(payload);
    ipcRenderer.on("job:status", listener);
    return () => ipcRenderer.removeListener("job:status", listener);
  },
};

contextBridge.exposeInMainWorld("ffmpegStudio", api);
