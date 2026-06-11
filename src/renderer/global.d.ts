import type { FfmpegStudioApi } from "../main/preload";

declare global {
  interface Window {
    ffmpegStudio: FfmpegStudioApi;
  }
}

export {};
