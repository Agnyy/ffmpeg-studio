import type { PreviewRuntimeDebug } from "./previewE2eWindow";
import type { PreviewBufferedRange } from "../../shared/previewBufferedRanges";
import {
  formatPreviewBufferedRangesSample,
  hasSeparatedPreviewBufferRanges,
} from "../../shared/previewBufferedRanges";
import {
  evaluatePreviewSelftestPass,
  type PreviewSelftestResult,
} from "../../shared/previewSelftestTypes";
import { getPreviewE2eDebugSnapshot } from "./previewE2eDebug";
import {
  clickPreviewPlayButton,
  clickTimelineAtTime,
  queryTimelineRuler,
} from "./previewUiTestActions";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export type PreviewSelftestRunnerOptions = {
  filePath: string;
  importFile: (filePath: string) => Promise<void>;
  getProjectItemsCount: () => number;
  getTimelineLayersCount: () => number;
  getCurrentTime: () => number;
  getIsPlaying: () => boolean;
};

function emptyResult(filePath: string): PreviewSelftestResult {
  return {
    file: filePath,
    appStarted: true,
    fileImported: false,
    timelineLayerExists: false,
    engineOpened: false,
    humanPaced: true,
    initialChecksum: 0,
    drawCountInitial: 0,
    initialLastDrawnTimeSec: null,
    initialSnapshot: "",
    seek10Checksum: 0,
    seek30Checksum: 0,
    playDrawCountBefore: 0,
    playDrawCountAfter: 0,
    playChecksumBefore: 0,
    playChecksumAfter: 0,
    play0LastDrawnTimeBefore: null,
    play0LastDrawnTimeAfter: null,
    play0SnapshotBefore: "",
    play0SnapshotAfter: "",
    playFrom10Checksum: 0,
    play10LastDrawnTimeBefore: null,
    play10LastDrawnTimeAfter: null,
    play10DisplayDriftAfter: null,
    play10QueueTimeRangeAfter: "",
    play10SnapshotBefore: "",
    play10SnapshotAfter: "",
    seek10Snapshot: "",
    seek10ActualDrawnTimeSec: null,
    seek70Checksum: 0,
    seek70Snapshot: "",
    seek70ActualDrawnTimeSec: null,
    play70LastDrawnTimeBefore: null,
    play70LastDrawnTimeAfter: null,
    play70DisplayDriftAfter: null,
    play70QueueTimeRangeAfter: "",
    play70SnapshotBefore: "",
    play70SnapshotAfter: "",
    engineStateAfterSeek70: "",
    engineStateAfterPlay70: "",
    pausedOk: false,
    seekWhilePlaying20Ok: false,
    seekWhilePlaying40Ok: false,
    unbufferedPlayOk: false,
    unbufferedSeekWhilePlayingOk: false,
    separatedBufferRangesOk: false,
    cacheBarSeparatedRangesOk: false,
    previewBufferRangeCount: 0,
    previewBufferedRangesSample: "",
    engineStateAfterInitial: "",
    engineStateAfterPlay0: "",
    engineStateAfterPause: "",
    engineStateAfterSeek10: "",
    engineStateAfterPlay10: "",
    audioElementOk: false,
    audioPlay10PausedBefore: null,
    audioPlay10PausedAfter: null,
    audioPlay10CurrentTimeBefore: null,
    audioPlay10CurrentTimeAfter: null,
    audioSeek10CurrentTime: null,
    audioPauseOk: false,
    audioPlay10AdvancesOk: false,
    audioSeek10Ok: false,
    visibleError: null,
    engineStatus: "",
    isPlaying: false,
    uiClickVerified: false,
    uiPlayButtonVerified: true,
    uiTimelineClickVerified: true,
    uiPlayheadDragVerified: false,
    seekDuringPlayVerified: false,
    isPlayingAfterSeek: false,
    appCrashed: false,
    pass: false,
    finishedAt: new Date().toISOString(),
  };
}

function fail(
  result: PreviewSelftestResult,
  stage: string,
  reason: string
): PreviewSelftestResult {
  result.uiClickVerified =
    result.uiPlayButtonVerified && result.uiTimelineClickVerified;
  result.failureStage = stage;
  result.failureReason = reason;
  result.pass = false;
  result.finishedAt = new Date().toISOString();
  return result;
}

function pass(result: PreviewSelftestResult): PreviewSelftestResult {
  result.uiClickVerified =
    result.uiPlayButtonVerified && result.uiTimelineClickVerified;
  result.pass = evaluatePreviewSelftestPass(result);
  result.finishedAt = new Date().toISOString();
  if (result.pass) {
    result.failureStage = undefined;
    result.failureReason = undefined;
  }
  return result;
}

function formatRuntimeSnapshot(label: string, runtime: PreviewRuntimeDebug): string {
  const drawn = runtime.lastDrawnTimeSec !== null ? runtime.lastDrawnTimeSec.toFixed(3) : "null";
  const drift =
    runtime.displayDrift !== null ? runtime.displayDrift.toFixed(3) : "null";
  const queueRange =
    runtime.queueTimeRangeMin !== null && runtime.queueTimeRangeMax !== null
      ? `${runtime.queueTimeRangeMin.toFixed(3)}-${runtime.queueTimeRangeMax.toFixed(3)}`
      : "empty";
  return (
    `${label}: checksum=${runtime.lastChecksum}, drawCount=${runtime.drawCount}, ` +
    `lastDrawnTime=${drawn}, enginePlayhead=${runtime.enginePlayheadSec.toFixed(3)}, ` +
    `displayDrift=${drift}, queueDepth=${runtime.queueDepth}, queueTimeRange=${queueRange}, ` +
    `decodedFrames=${runtime.decodedFrames}, enginePhase=${runtime.enginePhase}, ` +
    `enginePlaying=${runtime.engineIsPlaying}`
  );
}

function formatQueueTimeRange(runtime: PreviewRuntimeDebug): string {
  if (runtime.queueTimeRangeMin === null || runtime.queueTimeRangeMax === null) {
    return "empty";
  }
  return `${runtime.queueTimeRangeMin.toFixed(3)}-${runtime.queueTimeRangeMax.toFixed(3)}`;
}

function displayDriftSec(runtime: PreviewRuntimeDebug): number | null {
  if (runtime.displayDrift !== null) {
    return runtime.displayDrift;
  }
  if (runtime.lastDrawnTimeSec === null) {
    return null;
  }
  return runtime.enginePlayheadSec - runtime.lastDrawnTimeSec;
}

function captureAudioDebug() {
  return getPreviewE2eDebugSnapshot()?.getAudioDebug?.() ?? null;
}

async function captureRuntimeSnapshot(): Promise<PreviewRuntimeDebug | null> {
  const debug = getPreviewE2eDebugSnapshot();
  if (!debug) {
    return null;
  }
  return debug.getPreviewRuntimeDebug();
}

function visiblePlaybackAdvanced(
  before: PreviewRuntimeDebug,
  after: PreviewRuntimeDebug,
  minTimeAdvanceSec: number
): boolean {
  const beforeTime = before.lastDrawnTimeSec ?? -1;
  const afterTime = after.lastDrawnTimeSec ?? -1;
  return (
    after.drawCount > before.drawCount &&
    afterTime > beforeTime + minTimeAdvanceSec &&
    after.lastChecksum > 0
  );
}

function engineAheadOfVisibleCanvas(
  before: PreviewRuntimeDebug,
  after: PreviewRuntimeDebug
): boolean {
  const beforeDrawn = before.lastDrawnTimeSec ?? 0;
  const afterDrawn = after.lastDrawnTimeSec ?? 0;
  return (
    after.engineIsPlaying &&
    after.enginePlayheadSec > beforeDrawn + 0.5 &&
    after.drawCount <= before.drawCount &&
    afterDrawn <= beforeDrawn + 0.1
  );
}

function syncDebugFields(result: PreviewSelftestResult): void {
  const debug = getPreviewE2eDebugSnapshot();
  if (!debug) {
    return;
  }
  result.visibleError = debug.getVisibleError();
  result.engineStatus = debug.getEngineStatus();
  result.engineOpened = debug.getSessionReady();
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

async function waitForEnginePaused(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const runtime = await captureRuntimeSnapshot();
    if (runtime && !runtime.engineIsPlaying && runtime.enginePhase === "paused") {
      return true;
    }
    await sleep(250);
  }
  return false;
}

function hasBufferRangeNear(
  ranges: PreviewBufferedRange[],
  targetSec: number,
  toleranceSec = 2
): boolean {
  return ranges.some(
    (range) =>
      targetSec >= range.start - toleranceSec && targetSec <= range.end + toleranceSec
  );
}

async function fetchPreviewBufferedRanges(): Promise<PreviewBufferedRange[]> {
  const state = await window.ffmpegStudio.previewEngineGetState();
  return state.previewBufferedRanges ?? [];
}

async function waitForDrawnNearTarget(
  targetSec: number,
  beforeDrawCount: number,
  timeoutMs: number
): Promise<PreviewRuntimeDebug | null> {
  const deadline = Date.now() + timeoutMs;
  let latest: PreviewRuntimeDebug | null = null;
  while (Date.now() < deadline) {
    await sleep(500);
    const runtime = await captureRuntimeSnapshot();
    if (!runtime) {
      continue;
    }
    latest = runtime;
    const drawnNearTarget =
      runtime.drawCount > beforeDrawCount &&
      runtime.lastDrawnTimeSec !== null &&
      Math.abs(runtime.lastDrawnTimeSec - targetSec) <= 1.5 &&
      runtime.lastChecksum > 0 &&
      runtime.enginePhase !== "seeking" &&
      runtime.enginePhase !== "buffering";
    if (drawnNearTarget) {
      return runtime;
    }
  }
  return latest;
}

async function waitForInitialFrame(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const debug = getPreviewE2eDebugSnapshot();
    if (!debug) {
      await sleep(250);
      continue;
    }

    const visibleError = debug.getVisibleError();
    const engineStatus = debug.getEngineStatus();
    if (visibleError && engineStatus === "engine error") {
      return false;
    }
    if (engineStatus === "engine error") {
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

export async function runPreviewSelftest(
  options: PreviewSelftestRunnerOptions
): Promise<PreviewSelftestResult> {
  const result = emptyResult(options.filePath);

  try {
    await waitForAppReady(60_000);

    await options.importFile(options.filePath);
    result.fileImported = true;

    const importReady = await waitForImportComplete(
      options.getProjectItemsCount,
      options.getTimelineLayersCount,
      30_000
    );
    result.timelineLayerExists = importReady;

    if (!result.timelineLayerExists) {
      return fail(
        result,
        "import",
        `Expected footage and timeline layer (items=${options.getProjectItemsCount()}, layers=${options.getTimelineLayersCount()})`
      );
    }

    const debugReady = await waitForDebugApi(30_000);
    if (!debugReady) {
      return fail(result, "startup", "Preview debug API not registered after import");
    }

    const timelineUiReady = await waitForTimelineUi(30_000);
    if (!timelineUiReady) {
      return fail(result, "ui-click", "Timeline UI not mounted");
    }

    await sleep(2000);

    const initialReady = await waitForInitialFrame(120_000);
    syncDebugFields(result);
    const initialRuntime = (await captureRuntimeSnapshot()) ?? {
      drawCount: 0,
      lastDrawnTimeSec: null,
      lastChecksum: 0,
      pollCount: 0,
      enginePlayheadSec: 0,
      engineIsPlaying: false,
      enginePhase: "unknown",
      queueDepth: 0,
      queueTimeRangeMin: null,
      queueTimeRangeMax: null,
      displayDrift: null,
      decodedFrames: 0,
    };
    result.initialChecksum = initialRuntime.lastChecksum;
    result.drawCountInitial = initialRuntime.drawCount;
    result.initialLastDrawnTimeSec = initialRuntime.lastDrawnTimeSec;
    result.initialSnapshot = formatRuntimeSnapshot("initial", initialRuntime);
    result.engineStateAfterInitial = result.initialSnapshot;

    if (!initialReady) {
      return fail(
        result,
        "initial-frame",
        result.visibleError
          ? `Visible error during initial frame: ${result.visibleError}`
          : `Timed out waiting for initial visible frame (${result.initialSnapshot})`
      );
    }

    if (result.visibleError) {
      return fail(result, "initial-frame", `Visible error: ${result.visibleError}`);
    }

    const initialAudio = captureAudioDebug();
    result.audioElementOk = initialAudio?.hasAudioElement === true;

    // Paused seek to 10s — single click, wait until canvas draws near 10s.
    const beforeSeek10 = await captureRuntimeSnapshot();
    if (!beforeSeek10) {
      return fail(result, "seek", "Preview runtime debug unavailable before seek10");
    }

    const click10 = clickTimelineAtTime(10);
    result.uiTimelineClickVerified = click10;
    if (!click10) {
      return fail(result, "ui-click", "Timeline click to 10s failed");
    }

    const afterSeek10 = await waitForDrawnNearTarget(10, beforeSeek10.drawCount, 45_000);
    syncDebugFields(result);
    if (result.visibleError) {
      return fail(result, "seek", `Visible error during paused seek to 10s: ${result.visibleError}`);
    }
    if (!afterSeek10) {
      return fail(result, "seek", "Preview runtime debug unavailable after seek10");
    }
    result.seek10Checksum = afterSeek10.lastChecksum;
    result.seek10Snapshot = formatRuntimeSnapshot("seek10", afterSeek10);
    result.seek10ActualDrawnTimeSec = afterSeek10.lastDrawnTimeSec;
    result.engineStateAfterSeek10 = result.seek10Snapshot;
    result.play10LastDrawnTimeBefore = afterSeek10.lastDrawnTimeSec;

    const seek10Drawn =
      afterSeek10.drawCount > beforeSeek10.drawCount &&
      afterSeek10.lastDrawnTimeSec !== null &&
      Math.abs(afterSeek10.lastDrawnTimeSec - 10) <= 1.5 &&
      afterSeek10.lastChecksum > 0;

    const seek10Audio = captureAudioDebug();
    result.audioSeek10CurrentTime = seek10Audio?.currentTime ?? null;
    result.audioSeek10Ok =
      seek10Audio?.hasAudioElement === true &&
      seek10Audio.paused === true &&
      Math.abs(seek10Audio.currentTime - 10) <= 1.5;

    if (!seek10Drawn) {
      return fail(
        result,
        "seek",
        `seek10 target=10 actualDrawnTime=${afterSeek10.lastDrawnTimeSec?.toFixed(3) ?? "null"} (before=${formatRuntimeSnapshot("seek10-before", beforeSeek10)}, after=${result.seek10Snapshot})`
      );
    }

    if (!result.audioElementOk) {
      return fail(result, "audio", "Preview audio element not found after initial frame");
    }

    if (!result.audioSeek10Ok) {
      return fail(
        result,
        "audio",
        `Paused seek to 10s: audio.currentTime=${seek10Audio?.currentTime?.toFixed(3) ?? "null"} (paused=${seek10Audio?.paused ?? "n/a"})`
      );
    }

    // Play from 10s — single click, wait 3s.
    const beforePlay10 = afterSeek10;
    const beforePlay10Audio = captureAudioDebug();
    result.audioPlay10CurrentTimeBefore = beforePlay10Audio?.currentTime ?? null;
    result.audioPlay10PausedBefore = beforePlay10Audio?.paused ?? null;
    result.play10SnapshotBefore = formatRuntimeSnapshot("play10-before", beforePlay10);

    const play10Clicked = clickPreviewPlayButton();
    result.uiPlayButtonVerified = result.uiPlayButtonVerified && play10Clicked;
    if (!play10Clicked) {
      return fail(result, "ui-click", "Play button click after seek failed");
    }

    await sleep(3000);

    syncDebugFields(result);
    const afterPlay10 = await captureRuntimeSnapshot();
    if (!afterPlay10) {
      return fail(result, "playback", "Preview runtime debug unavailable after play10");
    }
    result.playFrom10Checksum = afterPlay10.lastChecksum;
    result.play10LastDrawnTimeAfter = afterPlay10.lastDrawnTimeSec;
    result.play10DisplayDriftAfter = displayDriftSec(afterPlay10);
    result.play10QueueTimeRangeAfter = formatQueueTimeRange(afterPlay10);
    result.play10SnapshotAfter = formatRuntimeSnapshot("play10-after", afterPlay10);
    result.engineStateAfterPlay10 = result.play10SnapshotAfter;
    result.isPlaying = options.getIsPlaying();

    if (result.visibleError) {
      return fail(result, "playback", `Visible error during play from 10s: ${result.visibleError}`);
    }

    if (engineAheadOfVisibleCanvas(beforePlay10, afterPlay10)) {
      return fail(
        result,
        "playback",
        `Engine playhead advanced but visible canvas did not update (play10 ${result.play10SnapshotBefore} -> ${result.play10SnapshotAfter})`
      );
    }

    if (afterPlay10.engineIsPlaying && afterPlay10.queueDepth === 0 && afterPlay10.decodedFrames <= beforePlay10.decodedFrames) {
      return fail(
        result,
        "playback",
        `Engine playing with empty queue and no new decoded frames (${result.play10SnapshotAfter})`
      );
    }

    const play10Drift = displayDriftSec(afterPlay10);
    if (play10Drift !== null && play10Drift > 0.75) {
      return fail(
        result,
        "playback",
        `Play from 10s: canvas lag behind engine (displayDrift=${play10Drift.toFixed(3)}s > 0.75s, ${result.play10SnapshotAfter})`
      );
    }

    const play10Time = afterPlay10.lastDrawnTimeSec ?? -1;
    const play10BeforeTime = beforePlay10.lastDrawnTimeSec ?? -1;
    if (
      !visiblePlaybackAdvanced(beforePlay10, afterPlay10, 0.5) ||
      play10Time <= 10.5 ||
      play10Time <= play10BeforeTime + 0.5
    ) {
      return fail(
        result,
        "playback",
        `Play from 10s: visible canvas did not advance beyond 10s (${result.play10SnapshotBefore} -> ${result.play10SnapshotAfter})`
      );
    }

    if (result.isPlaying && !afterPlay10.engineIsPlaying) {
      return fail(
        result,
        "playback",
        `UI isPlaying but engine paused after Play from 10s (${result.play10SnapshotAfter})`
      );
    }

    const afterPlay10Audio = captureAudioDebug();
    result.audioPlay10CurrentTimeAfter = afterPlay10Audio?.currentTime ?? null;
    result.audioPlay10PausedAfter = afterPlay10Audio?.paused ?? null;
    result.audioPlay10AdvancesOk =
      afterPlay10Audio?.hasAudioElement === true &&
      afterPlay10Audio.paused === false &&
      afterPlay10Audio.currentTime > (beforePlay10Audio?.currentTime ?? 0) + 0.3 &&
      afterPlay10Audio.currentTime > 10.3;

    if (!result.audioPlay10AdvancesOk) {
      return fail(
        result,
        "audio",
        `Play from 10s: audio.currentTime ${beforePlay10Audio?.currentTime?.toFixed(3) ?? "null"} -> ${afterPlay10Audio?.currentTime?.toFixed(3) ?? "null"} (paused=${afterPlay10Audio?.paused ?? "n/a"})`
      );
    }

    // Pause after play10.
    const pauseAfter10Clicked = clickPreviewPlayButton();
    result.uiPlayButtonVerified = result.uiPlayButtonVerified && pauseAfter10Clicked;
    if (!pauseAfter10Clicked) {
      return fail(result, "ui-click", "Pause button click after play10 failed");
    }
    const enginePausedAfter10 = await waitForEnginePaused(5000);
    syncDebugFields(result);
    result.isPlaying = options.getIsPlaying();
    const pausedAfter10Runtime = await captureRuntimeSnapshot();
    result.engineStateAfterPause = pausedAfter10Runtime
      ? formatRuntimeSnapshot("pause-after-play10", pausedAfter10Runtime)
      : "n/a";
    const pausedStatus = getPreviewE2eDebugSnapshot()?.getEngineStatus() ?? "";
    result.pausedOk =
      !result.isPlaying &&
      pausedStatus !== "playing" &&
      enginePausedAfter10 &&
      pausedAfter10Runtime?.engineIsPlaying === false;

    const pausedAudio = captureAudioDebug();
    result.audioPauseOk = pausedAudio?.hasAudioElement === true && pausedAudio.paused === true;

    if (!result.pausedOk) {
      return fail(
        result,
        "pause",
        `Pause after play10 failed (engineStatus=${pausedStatus}, isPlaying=${result.isPlaying}, enginePaused=${enginePausedAfter10}, ${result.engineStateAfterPause})`
      );
    }

    if (!result.audioPauseOk) {
      return fail(
        result,
        "audio",
        `Pause after play10: audio.paused=${pausedAudio?.paused ?? "n/a"}`
      );
    }

    const rangesAfterPause = await fetchPreviewBufferedRanges();
    result.previewBufferRangeCount = rangesAfterPause.length;
    result.previewBufferedRangesSample = formatPreviewBufferedRangesSample(rangesAfterPause);

    // Paused seek to 70s.
    const beforeSeek70 = await captureRuntimeSnapshot();
    if (!beforeSeek70) {
      return fail(result, "seek", "Preview runtime debug unavailable before seek70");
    }

    const click70 = clickTimelineAtTime(70);
    result.uiTimelineClickVerified = result.uiTimelineClickVerified && click70;
    if (!click70) {
      return fail(result, "ui-click", "Timeline click to 70s failed");
    }

    const afterSeek70 = await waitForDrawnNearTarget(70, beforeSeek70.drawCount, 60_000);
    syncDebugFields(result);
    if (result.visibleError) {
      return fail(result, "seek", `Visible error during paused seek to 70s: ${result.visibleError}`);
    }
    if (!afterSeek70) {
      return fail(result, "seek", "Preview runtime debug unavailable after seek70");
    }
    result.seek70Checksum = afterSeek70.lastChecksum;
    result.seek70Snapshot = formatRuntimeSnapshot("seek70", afterSeek70);
    result.seek70ActualDrawnTimeSec = afterSeek70.lastDrawnTimeSec;
    result.engineStateAfterSeek70 = result.seek70Snapshot;

    const seek70Drawn =
      afterSeek70.drawCount > beforeSeek70.drawCount &&
      afterSeek70.lastDrawnTimeSec !== null &&
      Math.abs(afterSeek70.lastDrawnTimeSec - 70) <= 1.5 &&
      afterSeek70.lastChecksum > 0;

    if (!seek70Drawn) {
      return fail(
        result,
        "seek",
        `seek70 target=70 actualDrawnTime=${afterSeek70.lastDrawnTimeSec?.toFixed(3) ?? "null"} (before=${formatRuntimeSnapshot("seek70-before", beforeSeek70)}, after=${result.seek70Snapshot})`
      );
    }

    // Play from 70s.
    const beforePlay70 = afterSeek70;
    result.play70LastDrawnTimeBefore = beforePlay70.lastDrawnTimeSec;
    result.play70SnapshotBefore = formatRuntimeSnapshot("play70-before", beforePlay70);

    const play70Clicked = clickPreviewPlayButton();
    result.uiPlayButtonVerified = result.uiPlayButtonVerified && play70Clicked;
    if (!play70Clicked) {
      return fail(result, "ui-click", "Play button click after seek70 failed");
    }

    await sleep(3000);

    syncDebugFields(result);
    const afterPlay70 = await captureRuntimeSnapshot();
    if (!afterPlay70) {
      return fail(result, "playback", "Preview runtime debug unavailable after play70");
    }
    result.play70LastDrawnTimeAfter = afterPlay70.lastDrawnTimeSec;
    result.play70DisplayDriftAfter = displayDriftSec(afterPlay70);
    result.play70QueueTimeRangeAfter = formatQueueTimeRange(afterPlay70);
    result.play70SnapshotAfter = formatRuntimeSnapshot("play70-after", afterPlay70);
    result.engineStateAfterPlay70 = result.play70SnapshotAfter;
    result.isPlaying = options.getIsPlaying();

    if (result.visibleError) {
      return fail(result, "playback", `Visible error during play from 70s: ${result.visibleError}`);
    }

    if (engineAheadOfVisibleCanvas(beforePlay70, afterPlay70)) {
      return fail(
        result,
        "playback",
        `Engine playhead advanced but visible canvas did not update (play70 ${result.play70SnapshotBefore} -> ${result.play70SnapshotAfter})`
      );
    }

    const play70Drift = displayDriftSec(afterPlay70);
    if (play70Drift !== null && play70Drift > 0.75) {
      return fail(
        result,
        "playback",
        `Play from 70s: canvas lag behind engine (displayDrift=${play70Drift.toFixed(3)}s > 0.75s, ${result.play70SnapshotAfter})`
      );
    }

    const play70Time = afterPlay70.lastDrawnTimeSec ?? -1;
    const play70BeforeTime = beforePlay70.lastDrawnTimeSec ?? -1;
    if (
      !visiblePlaybackAdvanced(beforePlay70, afterPlay70, 0.5) ||
      play70Time <= 70.5 ||
      play70Time <= play70BeforeTime + 0.5
    ) {
      return fail(
        result,
        "playback",
        `play70 before/after lastDrawnTime=${play70BeforeTime.toFixed(3)} -> ${play70Time.toFixed(3)} (${result.play70SnapshotBefore} -> ${result.play70SnapshotAfter})`
      );
    }

    const finalRanges = await fetchPreviewBufferedRanges();
    result.previewBufferRangeCount = finalRanges.length;
    result.previewBufferedRangesSample = formatPreviewBufferedRangesSample(finalRanges);
    result.separatedBufferRangesOk =
      hasSeparatedPreviewBufferRanges(finalRanges) &&
      hasBufferRangeNear(finalRanges, 10) &&
      hasBufferRangeNear(finalRanges, 70);
    result.cacheBarSeparatedRangesOk = result.separatedBufferRangesOk;

    if (!result.separatedBufferRangesOk) {
      return fail(
        result,
        "cache",
        `previewBufferedRanges=[${result.previewBufferedRangesSample}] — expected separated ranges near 10s and 70s`
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
