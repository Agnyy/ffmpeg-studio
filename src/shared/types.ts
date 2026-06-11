export type FfmpegSourceSetting = "auto" | "bundled" | "system" | "custom";

export type FfmpegResolveResult = {
  ok: boolean;
  ffmpegPath?: string;
  ffprobePath?: string;
  source?: "custom" | "bundled" | "npm" | "system";
  version?: string;
  error?: string;
};

export type MediaInfo = {
  durationSeconds: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  pixelFormat?: string;
  bitrate?: number;
  fps?: number;
};

export type JobStatus = "pending" | "running" | "done" | "error" | "cancelled";

export type JobKind = "render" | "preview-cache" | "proxy" | "analysis";

export type FfmpegFilterInfo = {
  name: string;
  description: string;
};

export type Job = {
  id: string;
  jobKind: JobKind;
  title: string;
  status: JobStatus;
  progress: number;
  log: string[];
  error?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  command?: string;
  args: string[];
  inputPath: string;
  outputPath: string;
  /** @deprecated use jobKind */
  presetId?: string;
  durationSeconds?: number;
  /** @deprecated use title */
  label?: string;
  relatedLayerId?: string;
  relatedEffectId?: string;
  relatedProjectItemId?: string;
};

export type PreviewBackendSetting = "chromium-video" | "node-av";

export type Settings = {
  ffmpegSource: FfmpegSourceSetting;
  customFfmpegPath: string;
  customFfprobePath: string;
  autoCreatePreviewProxy?: boolean;
  previewBackend?: PreviewBackendSetting;
};

export type ResizePresetOption = "1920x1080" | "1280x720" | "1080x1080" | "1080x1920";

export type PresetOptions = {
  resize?: ResizePresetOption;
  trimStart?: string;
  trimDuration?: string;
  editClip?: import("./clipEdit").EditClipOptions;
};

export type JobLogEvent = {
  jobId: string;
  line: string;
};

export type JobProgressEvent = {
  jobId: string;
  progress: number;
  indeterminate: boolean;
};

export type JobStatusEvent = {
  jobId: string;
  status: JobStatus;
  error?: string;
  outputPath?: string;
};
