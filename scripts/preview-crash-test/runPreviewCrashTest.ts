import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PreviewCrashTestResult } from "../../src/shared/previewCrashTestTypes.ts";
import { formatPreviewCrashTestReport } from "./formatPreviewCrashTestReport.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const RESULT_PATH = path.join(ROOT, "tmp", "preview-crash-test-result.json");
const TIMEOUT_MS = 360_000;

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
  const envPath = process.env.PREVIEW_CRASH_TEST_FILE?.trim();
  if (!envPath) {
    throw new Error(
      "PREVIEW_CRASH_TEST_FILE is required. Example:\n" +
        '  PREVIEW_CRASH_TEST_FILE="C:\\path\\to\\video.mp4" npm run preview:crash-test'
    );
  }
  return path.resolve(envPath);
}

async function ensureTestFileExists(filePath: string): Promise<void> {
  if (!(await fileExists(filePath))) {
    throw new Error(`PREVIEW_CRASH_TEST_FILE does not exist: ${filePath}`);
  }
}

async function waitForResult(timeoutMs: number): Promise<PreviewCrashTestResult | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fileExists(RESULT_PATH)) {
      const raw = await readFile(RESULT_PATH, "utf8");
      return JSON.parse(raw) as PreviewCrashTestResult;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

function timeoutResult(testFile: string): PreviewCrashTestResult {
  return {
    file: testFile,
    appStarted: true,
    fileImported: false,
    timelineLayerExists: false,
    engineOpened: false,
    initialFrameOk: false,
    cyclesCompleted: 0,
    cyclesRequested: 10,
    finalDrawCount: 0,
    finalChecksum: 0,
    finalLastDrawnTimeSec: null,
    playbackAfterStressOk: false,
    visibleError: "Timed out waiting for preview-crash-test-result.json",
    appCrashed: true,
    pass: false,
    failureStage: "timeout",
    failureReason: `Timed out after ${TIMEOUT_MS}ms`,
    finishedAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  const lightMode = process.argv.includes("--light");
  if (lightMode && !process.env.PREVIEW_CRASH_TEST_CYCLES) {
    process.env.PREVIEW_CRASH_TEST_CYCLES = "3";
  }

  const testFile = resolveTestFile();
  await ensureTestFileExists(testFile);
  await mkdir(path.dirname(RESULT_PATH), { recursive: true });
  await rm(RESULT_PATH, { force: true });

  console.log("Building app bundle for preview crash test…");
  const buildCode = await runCommand("npm", ["run", "build:bundle"], process.env);
  if (buildCode !== 0) {
    process.exit(buildCode);
  }

  const electronCli = path.join(ROOT, "node_modules", "electron", "cli.js");
  const mainEntry = path.join(ROOT, "dist-electron", "main.js");
  const env = {
    ...process.env,
    PREVIEW_CRASH_TEST: "1",
    PREVIEW_CRASH_TEST_FILE: testFile,
    PREVIEW_CRASH_TEST_CYCLES: process.env.PREVIEW_CRASH_TEST_CYCLES ?? "10",
    PREVIEW_E2E: "1",
    PREVIEW_E2E_FILE: testFile,
  };

  console.log(`Launching Electron preview crash test for:\n  ${testFile}\n`);

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
    console.log("\n" + formatPreviewCrashTestReport(failed));
    process.exit(1);
  }

  await writeFile(RESULT_PATH, JSON.stringify(result, null, 2), "utf8");
  console.log("\n" + formatPreviewCrashTestReport(result));

  const exitCode = await exitPromise.catch(() => (result.pass ? 0 : 1));
  process.exit(result.pass ? 0 : exitCode || 1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
