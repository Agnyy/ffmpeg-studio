import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { parseProgressFromLine } from "./progressParser";

export type FfmpegJobCallbacks = {
  onLog?: (line: string) => void;
  onProgress?: (progress: number, indeterminate: boolean) => void;
  onDone?: (code: number) => void;
  onError?: (error: Error) => void;
};

export type RunFfmpegJobOptions = {
  ffmpegPath: string;
  args: string[];
  durationSeconds?: number;
} & FfmpegJobCallbacks;

export type FfmpegJobHandle = {
  process: ChildProcessWithoutNullStreams;
  kill: () => void;
};

export function runFfmpegJob(options: RunFfmpegJobOptions): FfmpegJobHandle {
  const {
    ffmpegPath,
    args,
    durationSeconds,
    onLog,
    onProgress,
    onDone,
    onError,
  } = options;

  const proc = spawn(ffmpegPath, args, {
    shell: false,
    windowsHide: true,
  });

  const emitLog = (line: string) => {
    onLog?.(line);
    const parsed = parseProgressFromLine(line, durationSeconds);
    if (parsed) {
      onProgress?.(parsed.progress, parsed.indeterminate);
    }
  };

  proc.stdout.on("data", (chunk: Buffer) => {
    chunk
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach(emitLog);
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    chunk
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach(emitLog);
  });

  proc.on("error", (err) => {
    onError?.(err);
  });

  proc.on("close", (code) => {
    onDone?.(code ?? 1);
  });

  if (durationSeconds === undefined || durationSeconds <= 0) {
    onProgress?.(0, true);
  }

  return {
    process: proc,
    kill: () => {
      proc.kill("SIGTERM");
    },
  };
}

export function runFfmpegAndWait(options: {
  ffmpegPath: string;
  args: string[];
}): Promise<{ code: number; logs: string[] }> {
  return new Promise((resolve, reject) => {
    const logs: string[] = [];
    runFfmpegJob({
      ffmpegPath: options.ffmpegPath,
      args: options.args,
      onLog: (line) => logs.push(line),
      onDone: (code) => resolve({ code, logs }),
      onError: (error) => reject(error),
    });
  });
}

export function formatCommandPreview(ffmpegPath: string, args: string[]): string {
  const quoteArg = (arg: string): string => {
    if (/[\s"'\\]/.test(arg)) {
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    return arg;
  };

  return [ffmpegPath, ...args.map(quoteArg)].join(" ");
}
