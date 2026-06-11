import { spawn } from "child_process";
import type { MediaInfo } from "../shared/types";

export async function probeMediaFile(
  ffprobePath: string,
  filePath: string
): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ];

    const proc = spawn(ffprobePath, args, {
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      reject(err);
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `ffprobe exited with code ${code}`));
        return;
      }

      try {
        const data = JSON.parse(stdout) as {
          format?: {
            duration?: string;
            bit_rate?: string;
          };
          streams?: Array<{
            codec_type?: string;
            codec_name?: string;
            pix_fmt?: string;
            width?: number;
            height?: number;
            r_frame_rate?: string;
            avg_frame_rate?: string;
          }>;
        };

        const videoStream = data.streams?.find((s) => s.codec_type === "video");
        const audioStream = data.streams?.find((s) => s.codec_type === "audio");

        const fpsSource =
          videoStream?.avg_frame_rate && videoStream.avg_frame_rate !== "0/0"
            ? videoStream.avg_frame_rate
            : videoStream?.r_frame_rate;

        let fps: number | undefined;
        if (fpsSource && fpsSource.includes("/")) {
          const [num, den] = fpsSource.split("/").map(Number);
          if (den > 0) {
            fps = num / den;
          }
        }

        resolve({
          durationSeconds: parseFloat(data.format?.duration ?? "0") || 0,
          width: videoStream?.width,
          height: videoStream?.height,
          videoCodec: videoStream?.codec_name,
          pixelFormat: videoStream?.pix_fmt,
          audioCodec: audioStream?.codec_name,
          bitrate: data.format?.bit_rate
            ? parseInt(data.format.bit_rate, 10)
            : undefined,
          fps,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}
