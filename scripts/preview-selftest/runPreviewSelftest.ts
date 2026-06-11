import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PreviewSelftestResult } from "../../src/shared/previewSelftestTypes.ts";
import { formatPreviewSelftestReport } from "./formatPreviewSelftestReport.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const RESULT_PATH = path.join(ROOT, "tmp", "preview-selftest-result.json");
const TIMEOUT_MS = 240_000;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env,
      stdio: "inherit",
      shell: true,
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function resolveTestFile(): string {
  const envPath = process.env.PREVIEW_SELFTEST_FILE?.trim();
  if (!envPath) {
    throw new Error(
      "PREVIEW_SELFTEST_FILE is required. Example:\n" +
        '  PREVIEW_SELFTEST_FILE="C:\\path\\to\\video.mp4" npm run preview:selftest'
    );
  }
  return path.resolve(envPath);
}

async function ensureTestFileExists(filePath: string): Promise<void> {
  if (!(await fileExists(filePath))) {
    throw new Error(`PREVIEW_SELFTEST_FILE does not exist: ${filePath}`);
  }
}

async function waitForResult(timeoutMs: number): Promise<PreviewSelftestResult | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fileExists(RESULT_PATH)) {
      const raw = await readFile(RESULT_PATH, "utf8");
      return JSON.parse(raw) as PreviewSelftestResult;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

function timeoutResult(testFile: string): PreviewSelftestResult {
  return {
    file: testFile,
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
    play10SnapshotBefore: "",
    play10SnapshotAfter: "",
    seek10Snapshot: "",
    seek10ActualDrawnTimeSec: null,
    seek70Checksum: 0,
    seek70Snapshot: "",
    seek70ActualDrawnTimeSec: null,
    play70LastDrawnTimeBefore: null,
    play70LastDrawnTimeAfter: null,
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
    visibleError: "Timed out waiting for preview-selftest-result.json",
    engineStatus: "",
    isPlaying: false,
    uiClickVerified: false,
    uiPlayButtonVerified: false,
    uiTimelineClickVerified: false,
    uiPlayheadDragVerified: false,
    seekDuringPlayVerified: false,
    isPlayingAfterSeek: false,
    appCrashed: true,
    pass: false,
    failureStage: "timeout",
    failureReason: `Timed out after ${TIMEOUT_MS}ms`,
    finishedAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  const testFile = resolveTestFile();
  await ensureTestFileExists(testFile);
  await mkdir(path.dirname(RESULT_PATH), { recursive: true });
  await rm(RESULT_PATH, { force: true });

  console.log(`Building app bundle for preview selftest…`);
  const buildCode = await runCommand("npm", ["run", "build:bundle"], process.env);
  if (buildCode !== 0) {
    process.exit(buildCode);
  }

  const electronCli = path.join(ROOT, "node_modules", "electron", "cli.js");
  const mainEntry = path.join(ROOT, "dist-electron", "main.js");
  const env = {
    ...process.env,
    PREVIEW_SELFTEST: "1",
    PREVIEW_SELFTEST_FILE: testFile,
    PREVIEW_E2E: "1",
    PREVIEW_E2E_FILE: testFile,
  };

  console.log(`Launching Electron preview selftest for:\n  ${testFile}\n`);

  const electron = spawn(process.execPath, [electronCli, mainEntry], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  electron.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  electron.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  const resultPromise = waitForResult(TIMEOUT_MS);
  const exitPromise = new Promise<number>((resolve) => {
    electron.on("close", (code) => resolve(code ?? 1));
  });

  const result = await resultPromise;
  if (!result) {
    electron.kill();
    await exitPromise.catch(() => undefined);
    const failed = timeoutResult(testFile);
    await writeFile(RESULT_PATH, JSON.stringify(failed, null, 2), "utf8");
    console.log("\n" + formatPreviewSelftestReport(failed));
    process.exit(1);
  }

  await writeFile(RESULT_PATH, JSON.stringify(result, null, 2), "utf8");
  console.log("\n" + formatPreviewSelftestReport(result));

  const exitCode = await exitPromise.catch(() => (result.pass ? 0 : 1));
  process.exit(result.pass ? 0 : exitCode || 1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
