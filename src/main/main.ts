import { app, BrowserWindow } from "electron";
import { installMainProcessFfmpegStderrFilter } from "./ffmpegLogFilter";

installMainProcessFfmpegStderrFilter(app.isPackaged);

if (
  process.env.PREVIEW_SELFTEST === "1" ||
  process.env.PREVIEW_E2E === "1" ||
  process.env.PREVIEW_CRASH_TEST === "1"
) {
  app.commandLine.appendSwitch("js-flags", "--max-old-space-size=8192");
}
import path, { join } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { registerIpcHandlers, setMainWindow } from "./ipc";
import { buildApplicationMenu } from "./menu";

process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, "../public");

let win: BrowserWindow | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function isPreviewTestMode(): boolean {
  return (
    process.env.PREVIEW_E2E === "1" ||
    process.env.PREVIEW_SELFTEST === "1" ||
    process.env.PREVIEW_CRASH_TEST === "1"
  );
}

function previewTestResultPath(): string {
  if (process.env.PREVIEW_CRASH_TEST === "1") {
    return join(process.cwd(), "tmp", "preview-crash-test-result.json");
  }
  if (process.env.PREVIEW_SELFTEST === "1") {
    return join(process.cwd(), "tmp", "preview-selftest-result.json");
  }
  return join(process.cwd(), "tmp", "preview-e2e-result.json");
}

function previewTestDriverGlobal(): string {
  if (process.env.PREVIEW_CRASH_TEST === "1") {
    return "__FFMPEG_STUDIO_RUN_PREVIEW_CRASH_TEST__";
  }
  if (process.env.PREVIEW_SELFTEST === "1") {
    return "__FFMPEG_STUDIO_RUN_PREVIEW_SELFTEST__";
  }
  return "__FFMPEG_STUDIO_RUN_PREVIEW_E2E__";
}

function previewTestFileEnv(): string {
  return (
    process.env.PREVIEW_CRASH_TEST_FILE ??
    process.env.PREVIEW_SELFTEST_FILE ??
    process.env.PREVIEW_E2E_FILE ??
    ""
  );
}

function crashTestCyclesRequested(): number {
  const raw = process.env.PREVIEW_CRASH_TEST_CYCLES?.trim();
  if (!raw) {
    return 10;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 10;
  }
  return parsed;
}

function writePreviewE2eFailure(reason: string, appCrashed: boolean): void {
  const outPath = previewTestResultPath();
  if (existsSync(outPath)) {
    return;
  }
  mkdirSync(join(process.cwd(), "tmp"), { recursive: true });
  const testFile = previewTestFileEnv();
  const failurePayload =
    process.env.PREVIEW_CRASH_TEST === "1"
      ? {
          file: testFile,
          appStarted: true,
          fileImported: false,
          timelineLayerExists: false,
          engineOpened: false,
          initialFrameOk: false,
          cyclesCompleted: 0,
          cyclesRequested: crashTestCyclesRequested(),
          finalDrawCount: 0,
          finalChecksum: 0,
          finalLastDrawnTimeSec: null,
          playbackAfterStressOk: false,
          visibleError: reason,
          appCrashed,
          pass: false,
          failureStage: "crash",
          failureReason: reason,
          finishedAt: new Date().toISOString(),
        }
      : process.env.PREVIEW_SELFTEST === "1"
      ? {
          file: testFile,
          appStarted: true,
          fileImported: false,
          timelineLayerExists: false,
          engineOpened: false,
          initialChecksum: 0,
          drawCountInitial: 0,
          seek10Checksum: 0,
          seek30Checksum: 0,
          playDrawCountBefore: 0,
          playDrawCountAfter: 0,
          playChecksumBefore: 0,
          playChecksumAfter: 0,
          pausedOk: false,
          visibleError: reason,
          engineStatus: "",
          isPlaying: false,
          uiClickVerified: false,
          appCrashed,
          pass: false,
          failureStage: "crash",
          failureReason: reason,
          finishedAt: new Date().toISOString(),
        }
      : {
          file: testFile,
          appStarted: true,
          imported: false,
          engineOpened: false,
          firstFrameVisible: false,
          firstFrameChecksum: 0,
          drawCountAfterOpen: 0,
          drawCountAfterPlay: 0,
          checksumAfterPlay: 0,
          checksumChanged: false,
          visibleError: reason,
          appCrashed,
          pass: false,
          failureReason: reason,
          finishedAt: new Date().toISOString(),
        };
  writeFileSync(outPath, JSON.stringify(failurePayload, null, 2), "utf8");
  const label = process.env.PREVIEW_CRASH_TEST === "1"
    ? "PREVIEW_CRASH_TEST"
    : process.env.PREVIEW_SELFTEST === "1"
      ? "PREVIEW_SELFTEST"
      : "PREVIEW_E2E";
  console.log(`[${label}] wrote failure result:`, reason);
}

function schedulePreviewE2eMainDriver(win: BrowserWindow): void {
  const pollIntervalMs = 1_000;
  const pollTimeoutMs =
    process.env.PREVIEW_CRASH_TEST === "1"
      ? 300_000
      : process.env.PREVIEW_SELFTEST === "1"
        ? 180_000
        : 90_000;
  const startedAt = Date.now();
  const driverGlobal = previewTestDriverGlobal();

  const poll = (): void => {
    if (!isPreviewTestMode() || existsSync(previewTestResultPath())) {
      return;
    }
    if (Date.now() - startedAt > pollTimeoutMs) {
      writePreviewE2eFailure("Timed out waiting for preview E2E driver on window", false);
      app.exit(1);
      return;
    }

    void win.webContents
      .executeJavaScript(
        `(async () => {
          const driver = window.${driverGlobal};
          if (typeof driver !== "function") {
            return { ready: false };
          }
          try {
            return { ready: true, result: await driver() };
          } catch (error) {
            return {
              ready: true,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })()`
      )
      .then((payload: { ready?: boolean; result?: unknown; error?: string }) => {
        if (existsSync(previewTestResultPath())) {
          return;
        }
        if (!payload?.ready) {
          setTimeout(poll, pollIntervalMs);
          return;
        }
        if (payload.result) {
          mkdirSync(join(process.cwd(), "tmp"), { recursive: true });
          writeFileSync(
            previewTestResultPath(),
            JSON.stringify(payload.result, null, 2),
            "utf8"
          );
          const pass = (payload.result as { pass?: boolean }).pass === true;
          const label = process.env.PREVIEW_CRASH_TEST === "1"
            ? "PREVIEW_CRASH_TEST"
            : process.env.PREVIEW_SELFTEST === "1"
              ? "PREVIEW_SELFTEST"
              : "PREVIEW_E2E";
          console.log(`[${label}] main driver finished`, pass ? "PASS" : "FAIL");
          app.exit(pass ? 0 : 1);
          return;
        }
        writePreviewE2eFailure(payload?.error ?? "Main driver returned no result", false);
        app.exit(1);
      })
      .catch((error) => {
        if (existsSync(previewTestResultPath())) {
          return;
        }
        if (Date.now() - startedAt > pollTimeoutMs) {
          writePreviewE2eFailure(
            error instanceof Error ? `Main driver failed: ${error.message}` : "Main driver failed",
            true
          );
          app.exit(1);
          return;
        }
        setTimeout(poll, pollIntervalMs);
      });
  };

  setTimeout(poll, 5_000);
}

function schedulePreviewE2eMainWatchdog(win: BrowserWindow): void {
  setTimeout(() => {
    if (!isPreviewTestMode()) {
      return;
    }
    const outPath = previewTestResultPath();
    if (existsSync(outPath)) {
      return;
    }

    void win.webContents
      .executeJavaScript(
        `(() => JSON.stringify({
          previewE2eEnabled: window.ffmpegStudio?.previewE2eEnabled === true,
          previewE2eFile: window.ffmpegStudio?.previewE2eFile ?? "",
          search: window.location.search,
          hasDebug: !!window.__FFMPEG_STUDIO_PREVIEW_DEBUG__,
        }))()`
      )
      .then((probeRaw) => {
        if (existsSync(outPath)) {
          return;
        }
        mkdirSync(join(process.cwd(), "tmp"), { recursive: true });
        writeFileSync(
          outPath,
          JSON.stringify(
            {
              file: previewTestFileEnv(),
              appStarted: true,
              imported: false,
              engineOpened: false,
              firstFrameVisible: false,
              firstFrameChecksum: 0,
              drawCountAfterOpen: 0,
              drawCountAfterPlay: 0,
              checksumAfterPlay: 0,
              checksumChanged: false,
              visibleError: "Renderer never wrote preview test result json",
              appCrashed: false,
              pass: false,
              failureReason: `Main watchdog: renderer probe ${probeRaw}`,
              finishedAt: new Date().toISOString(),
            },
            null,
            2
          ),
          "utf8"
        );
        app.exit(1);
      })
      .catch((error) => {
        if (existsSync(outPath)) {
          return;
        }
        writePreviewE2eFailure(
          error instanceof Error
            ? `Main watchdog probe failed: ${error.message}`
            : "Main watchdog probe failed",
          true
        );
        app.exit(1);
      });
  }, 120_000);
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "FFmpeg Studio",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      additionalArguments: isPreviewTestMode()
        ? [
            "--preview-e2e",
            `--preview-e2e-file=${previewTestFileEnv()}`,
            ...(process.env.PREVIEW_SELFTEST === "1" ? ["--preview-selftest"] : []),
            ...(process.env.PREVIEW_CRASH_TEST === "1" ? ["--preview-crash-test"] : []),
            ...(process.env.PREVIEW_SELFTEST_FILE
              ? [`--preview-selftest-file=${process.env.PREVIEW_SELFTEST_FILE}`]
              : []),
            ...(process.env.PREVIEW_CRASH_TEST_FILE
              ? [`--preview-crash-test-file=${process.env.PREVIEW_CRASH_TEST_FILE}`]
              : []),
          ]
        : [],
    },
  });

  setMainWindow(win);

  win.on("close", (event) => {
    if (isPreviewTestMode()) {
      return;
    }
    event.preventDefault();
    win?.webContents.send("app:beforeClose");
  });

  win.on("closed", () => {
    setMainWindow(null);
    win = null;
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    if (!isPreviewTestMode()) {
      return;
    }
    writePreviewE2eFailure(`Renderer process gone: ${details.reason}`, true);
    app.exit(1);
  });

  win.webContents.on("did-finish-load", () => {
    if (!isPreviewTestMode()) {
      return;
    }
    setTimeout(() => {
      win?.webContents.send("previewE2e:bootstrap", {
        file: previewTestFileEnv(),
      });
    }, 1500);
  });

  schedulePreviewE2eMainDriver(win);
  schedulePreviewE2eMainWatchdog(win);

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else if (isPreviewTestMode()) {
    win.loadFile(path.join(process.env.DIST!, "index.html"), {
      query: {
        previewE2e: "1",
        ...(process.env.PREVIEW_SELFTEST === "1" ? { previewSelftest: "1" } : {}),
        ...(process.env.PREVIEW_CRASH_TEST === "1" ? { previewCrashTest: "1" } : {}),
      },
    });
  } else {
    win.loadFile(path.join(process.env.DIST!, "index.html"));
  }
}

app.whenReady().then(() => {
  if (process.env.PREVIEW_CRASH_TEST === "1") {
    console.log("[PREVIEW_CRASH_TEST] main ready", process.env.PREVIEW_CRASH_TEST_FILE ?? "");
  } else if (process.env.PREVIEW_SELFTEST === "1") {
    console.log("[PREVIEW_SELFTEST] main ready", process.env.PREVIEW_SELFTEST_FILE ?? "");
  } else if (process.env.PREVIEW_E2E === "1") {
    console.log("[PREVIEW_E2E] main ready", process.env.PREVIEW_E2E_FILE ?? "");
  }
  registerIpcHandlers(() => win);
  buildApplicationMenu(() => win);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
