import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(path.join(root, "package.json"));
const binDir = path.join(root, "resources", "bin");

const isWin = process.platform === "win32";
const ffmpegName = isWin ? "ffmpeg.exe" : "ffmpeg";
const ffprobeName = isWin ? "ffprobe.exe" : "ffprobe";

function resolveNpmBinaries() {
  try {
    const mod = require("ffmpeg-ffprobe-static");
    return {
      ffmpeg: mod.ffmpegPath ?? null,
      ffprobe: mod.ffprobePath ?? null,
    };
  } catch {
    return { ffmpeg: null, ffprobe: null };
  }
}

function isExecutableFile(filePath) {
  try {
    return existsSync(filePath) && statSync(filePath).isFile() && statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

function copyBinary(source, dest) {
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(source, dest);
  console.log(`Copied ${path.basename(dest)} from ${source}`);
}

const destFfmpeg = path.join(binDir, ffmpegName);
const destFfprobe = path.join(binDir, ffprobeName);

if (isExecutableFile(destFfmpeg) && isExecutableFile(destFfprobe)) {
  console.log(`FFmpeg binaries already present in ${binDir}`);
  process.exit(0);
}

const npm = resolveNpmBinaries();

if (!isExecutableFile(npm.ffmpeg) || !isExecutableFile(npm.ffprobe)) {
  console.error(`
ERROR: FFmpeg binaries are missing for packaging.

Expected in: ${binDir}
  - ${ffmpegName}
  - ${ffprobeName}

Options:
  1. Run "npm install" so ffmpeg-ffprobe-static downloads platform binaries, then re-run this script.
  2. Place ${ffmpegName} and ${ffprobeName} in resources/bin/ manually (ensure license compliance).
  3. Run "npm run prepare:ffmpeg-bin" after npm install.

Source: ffmpeg-ffprobe-static (npm dependency) — verify license terms before redistributing.
`);
  process.exit(1);
}

copyBinary(npm.ffmpeg, destFfmpeg);
copyBinary(npm.ffprobe, destFfprobe);

console.log("FFmpeg binaries ready for electron-builder extraResources.");
