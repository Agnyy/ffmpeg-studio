import {
  evaluatePreviewCrashTestPass,
  type PreviewCrashTestResult,
} from "../../shared/previewCrashTestTypes";
import { getPreviewE2eDebugSnapshot } from "./previewE2eDebug";
import {
  clickPreviewPlayButton,
  clickTimelineAtTime,
  queryTimelineRuler,
} from "./previewUiTestActions";

const DEFAULT_STRESS_CYCLES = 10;

function resolveStressCyclesFromEnv(): number {
  const raw = process.env.PREVIEW_CRASH_TEST_CYCLES?.trim();
  if (!raw) {
    return DEFAULT_STRESS_CYCLES;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_STRESS_CYCLES;
  }
  return parsed;
}

function resolveStressCycles(): number {
  if (typeof window !== "undefined") {
    const fromApi = window.ffmpegStudio?.previewCrashTestCycles;
    if (typeof fromApi === "number" && Number.isFinite(fromApi) && fromApi >= 1) {
      return fromApi;
    }
  }
  return resolveStressCyclesFromEnv();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function emptyResult(filePath: string, cyclesRequested: number): PreviewCrashTestResult {
  return {
    file: filePath,
    appStarted: true,
    fileImported: false,
    timelineLayerExists: false,
    engineOpened: false,
    initialFrameOk: false,
    cyclesCompleted: 0,
    cyclesRequested,
    finalDrawCount: 0,
    finalChecksum: 0,
    finalLastDrawnTimeSec: null,
    playbackAfterStressOk: false,
    visibleError: null,
    appCrashed: false,
    pass: false,
    finishedAt: new Date().toISOString(),
  };
}

export type PreviewCrashTestRunnerOptions = {
  filePath: string;
  importFile: (filePath: string) => Promise<void>;
  getProjectItemsCount: () => number;
  getTimelineLayersCount: () => number;
  getIsPlaying: () => boolean;
};

function fail(
  result: PreviewCrashTestResult,
  stage: string,
  reason: string
): PreviewCrashTestResult {
  result.failureStage = stage;
  result.failureReason = reason;
  result.pass = false;
  result.finishedAt = new Date().toISOString();
  return result;
}

function pass(result: PreviewCrashTestResult): PreviewCrashTestResult {
  result.pass = evaluatePreviewCrashTestPass(result);
  result.finishedAt = new Date().toISOString();
  if (result.pass) {
    result.failureStage = undefined;
    result.failureReason = undefined;
  }
  return result;
}

async function waitForAppReady(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const root = document.getElementById("root");
    if (root && root.childElementCount > 0) {
      return;
    }
    await sleep(100);
  }
  throw new Error("Timed out waiting for app UI to mount");
}

async function waitForImportComplete(
  getProjectItemsCount: () => number,
  getTimelineLayersCount: () => number,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getProjectItemsCount() > 0 && getTimelineLayersCount() > 0) {
      return true;
    }
    await sleep(250);
  }
  return false;
}

async function waitForDebugApi(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getPreviewE2eDebugSnapshot()) {
      return true;
    }
    await sleep(250);
  }
  return false;
}

async function waitForTimelineUi(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ruler = queryTimelineRuler();
    const playButton = document.querySelector('[data-testid="preview-play-button"]');
    if (ruler && playButton) {
      return true;
    }
    await sleep(250);
  }
  return false;
}

async function waitForInitialFrame(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const debug = getPreviewE2eDebugSnapshot();
    if (!debug) {
      await sleep(250);
      continue;
    }
    if (debug.getVisibleError()) {
      return false;
    }
    const runtime = await debug.getPreviewRuntimeDebug();
    if (
      debug.getSessionReady() &&
      runtime.drawCount >= 1 &&
      runtime.lastChecksum > 0 &&
      runtime.lastDrawnTimeSec !== null
    ) {
      return true;
    }
    await sleep(250);
  }
  return false;
}

export async function runPreviewCrashTest(
  options: PreviewCrashTestRunnerOptions
): Promise<PreviewCrashTestResult> {
  const stressCycles = resolveStressCycles();
  const result = emptyResult(options.filePath, stressCycles);

  try {
    await waitForAppReady(60_000);
    await options.importFile(options.filePath);
    result.fileImported = true;

    result.timelineLayerExists = await waitForImportComplete(
      options.getProjectItemsCount,
      options.getTimelineLayersCount,
      30_000
    );
    if (!result.timelineLayerExists) {
      return fail(result, "import", "Timeline layer missing after import");
    }

    if (!(await waitForDebugApi(30_000))) {
      return fail(result, "startup", "Preview debug API not registered");
    }
    if (!(await waitForTimelineUi(30_000))) {
      return fail(result, "ui", "Timeline UI not mounted");
    }

    await sleep(2000);
    result.initialFrameOk = await waitForInitialFrame(120_000);
    const debug = getPreviewE2eDebugSnapshot();
    result.engineOpened = debug?.getSessionReady() ?? false;
    result.visibleError = debug?.getVisibleError() ?? null;

    if (!result.initialFrameOk) {
      return fail(result, "initial-frame", "Initial visible frame not ready");
    }

    clickPreviewPlayButton();
    await sleep(2000);

    for (let cycle = 0; cycle < stressCycles; cycle += 1) {
      clickTimelineAtTime(10);
      await sleep(1000);
      clickTimelineAtTime(70);
      await sleep(1000);
      clickTimelineAtTime(30);
      await sleep(1000);
      clickPreviewPlayButton();
      await sleep(500);
      clickPreviewPlayButton();
      await sleep(500);
      result.cyclesCompleted = cycle + 1;

      const runtime = await debug?.getPreviewRuntimeDebug();
      result.visibleError = debug?.getVisibleError() ?? null;
      if (result.visibleError) {
        return fail(
          result,
          "stress",
          `Visible error during stress cycle ${cycle + 1}: ${result.visibleError}`
        );
      }
      if (runtime && runtime.lastChecksum === 0 && runtime.drawCount === 0) {
        return fail(result, "stress", `Canvas lost during stress cycle ${cycle + 1}`);
      }
    }

    clickPreviewPlayButton();
    await sleep(2000);

    const finalRuntime = await debug?.getPreviewRuntimeDebug();
    result.finalDrawCount = finalRuntime?.drawCount ?? 0;
    result.finalChecksum = finalRuntime?.lastChecksum ?? 0;
    result.finalLastDrawnTimeSec = finalRuntime?.lastDrawnTimeSec ?? null;
    result.visibleError = debug?.getVisibleError() ?? null;
    result.playbackAfterStressOk =
      Boolean(finalRuntime) &&
      finalRuntime!.drawCount > 0 &&
      finalRuntime!.lastChecksum > 0 &&
      !result.visibleError;

    if (!result.playbackAfterStressOk) {
      return fail(
        result,
        "post-stress",
        `Preview not healthy after stress (drawCount=${result.finalDrawCount}, checksum=${result.finalChecksum})`
      );
    }

    return pass(result);
  } catch (error) {
    result.appCrashed = false;
    return fail(
      result,
      result.failureStage ?? "unexpected",
      error instanceof Error ? error.message : String(error)
    );
  }
}
