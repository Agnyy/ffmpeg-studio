import { execFileSync, spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { app } from "electron";
import type { FfmpegResolveResult, Settings } from "../shared/types";

const FFMPEG_BIN = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
const FFPROBE_BIN = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";

function getBundledBinDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bin");
  }
  return path.join(process.cwd(), "resources", "bin");
}

function getNpmBinPaths(): { ffmpeg?: string; ffprobe?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require("ffmpeg-ffprobe-static") as {
      ffmpegPath?: string;
      ffprobePath?: string;
    };
    return {
      ffmpeg: pkg.ffmpegPath,
      ffprobe: pkg.ffprobePath,
    };
  } catch {
    return {};
  }
}

function findInSystemPath(binary: string): string | undefined {
  try {
    if (process.platform === "win32") {
      const result = execFileSync("where", [binary.replace(".exe", "")], {
        encoding: "utf8",
        windowsHide: true,
      });
      return result.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim();
    }
    const result = execFileSync("which", [binary], {
      encoding: "utf8",
    });
    return result.trim() || undefined;
  } catch {
    return undefined;
  }
}

function deriveFfprobePath(ffmpegPath: string): string {
  const dir = path.dirname(ffmpegPath);
  const base = path.basename(ffmpegPath);
  if (base.toLowerCase().includes("ffmpeg")) {
    const probeBase = base.replace(/ffmpeg/i, "ffprobe");
    return path.join(dir, probeBase);
  }
  return path.join(dir, FFPROBE_BIN);
}

function verifyBinary(
  binaryPath: string,
  versionFlag: string
): Promise<{ ok: boolean; version?: string; error?: string }> {
  return new Promise((resolve) => {
    if (!existsSync(binaryPath)) {
      resolve({ ok: false, error: `Binary not found: ${binaryPath}` });
      return;
    }

    const proc = spawn(binaryPath, [versionFlag], {
      shell: false,
      windowsHide: true,
    });

    let output = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    proc.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });

    proc.on("close", (code) => {
      if (code === 0 || output.length > 0) {
        const firstLine = output.split(/\r?\n/)[0]?.trim();
        resolve({ ok: true, version: firstLine });
      } else {
        resolve({ ok: false, error: `Exit code ${code}` });
      }
    });
  });
}

async function verifyPair(
  ffmpegPath: string,
  ffprobePath: string
): Promise<{ ok: boolean; version?: string; error?: string }> {
  const ffmpegCheck = await verifyBinary(ffmpegPath, "-version");
  if (!ffmpegCheck.ok) {
    return ffmpegCheck;
  }

  const ffprobeCheck = await verifyBinary(ffprobePath, "-version");
  if (!ffprobeCheck.ok) {
    return ffprobeCheck;
  }

  return { ok: true, version: ffmpegCheck.version };
}

type Candidate = {
  ffmpegPath: string;
  ffprobePath: string;
  source: FfmpegResolveResult["source"];
};

function buildCandidates(settings: Settings): Candidate[] {
  const candidates: Candidate[] = [];

  const addCustom = () => {
    if (settings.customFfmpegPath.trim()) {
      const ffmpegPath = settings.customFfmpegPath.trim();
      const ffprobePath =
        settings.customFfprobePath.trim() || deriveFfprobePath(ffmpegPath);
      candidates.push({ ffmpegPath, ffprobePath, source: "custom" });
    }
  };

  const addBundled = () => {
    const binDir = getBundledBinDir();
    candidates.push({
      ffmpegPath: path.join(binDir, FFMPEG_BIN),
      ffprobePath: path.join(binDir, FFPROBE_BIN),
      source: "bundled",
    });
  };

  const addNpm = () => {
    const npm = getNpmBinPaths();
    if (npm.ffmpeg && npm.ffprobe) {
      candidates.push({
        ffmpegPath: npm.ffmpeg,
        ffprobePath: npm.ffprobe,
        source: "npm",
      });
    }
  };

  const addSystem = () => {
    const ffmpegPath = findInSystemPath(FFMPEG_BIN);
    if (ffmpegPath) {
      const ffprobePath =
        findInSystemPath(FFPROBE_BIN) || deriveFfprobePath(ffmpegPath);
      candidates.push({ ffmpegPath, ffprobePath, source: "system" });
    }
  };

  switch (settings.ffmpegSource) {
    case "custom":
      addCustom();
      break;
    case "bundled":
      addBundled();
      addNpm();
      break;
    case "system":
      addSystem();
      break;
    case "auto":
    default:
      addCustom();
      addBundled();
      addNpm();
      addSystem();
      break;
  }

  return candidates;
}

export async function resolveFfmpeg(
  settings: Settings
): Promise<FfmpegResolveResult> {
  const candidates = buildCandidates(settings);

  for (const candidate of candidates) {
    const verification = await verifyPair(
      candidate.ffmpegPath,
      candidate.ffprobePath
    );

    if (verification.ok) {
      return {
        ok: true,
        ffmpegPath: candidate.ffmpegPath,
        ffprobePath: candidate.ffprobePath,
        source: candidate.source,
        version: verification.version,
      };
    }
  }

  return {
    ok: false,
    error:
      settings.ffmpegSource === "custom"
        ? "Custom FFmpeg path is invalid or not executable."
        : "FFmpeg was not found. Install FFmpeg or configure a custom path in Settings.",
  };
}

export async function testFfmpeg(settings: Settings): Promise<FfmpegResolveResult> {
  return resolveFfmpeg(settings);
}
