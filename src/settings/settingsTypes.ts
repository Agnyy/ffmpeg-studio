export type { Settings, FfmpegSourceSetting } from "../shared/types";

export const DEFAULT_SETTINGS = {
  ffmpegSource: "auto" as const,
  customFfmpegPath: "",
  customFfprobePath: "",
  autoCreatePreviewProxy: true,
  previewBackend: "chromium-video" as const,
};
