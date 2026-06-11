import { spawn } from "child_process";
import { buildThumbnailPipeArgs } from "./thumbnailExtractor";

export type ThumbnailPipeResult = {
  data: Buffer;
  stderr: string;
};

export function runFfmpegThumbnailPipe(
  ffmpegPath: string,
  inputPath: string,
  timeSec = 0
): Promise<ThumbnailPipeResult> {
  return new Promise((resolve, reject) => {
    const args = buildThumbnailPipeArgs(inputPath, timeSec);
    const proc = spawn(ffmpegPath, args, { shell: false, windowsHide: true });
    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    proc.on("error", (error) => {
      reject(error);
    });

    proc.on("close", (code) => {
      const data = Buffer.concat(chunks);
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
      if (code !== 0 || data.length === 0) {
        reject(new Error(stderr || `FFmpeg thumbnail pipe exited with code ${code ?? 1}`));
        return;
      }
      resolve({ data, stderr });
    });
  });
}
