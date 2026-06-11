import type {
  PreviewCloseResult,
  PreviewFrameResult,
  PreviewOpenResult,
  PreviewSeekResult,
} from "./types";

/**
 * Placeholder for the renderer-side Chromium `<video>` preview path.
 * Main process does not decode Chromium previews — HTML video stays in VideoPreview.
 */
export class ChromiumPreviewService {
  async open(_filePath: string): Promise<PreviewOpenResult> {
    return {
      ok: false,
      error: "Chromium preview runs in the renderer via HTMLVideoElement",
    };
  }

  async seek(_timeSec: number): Promise<PreviewSeekResult> {
    return {
      ok: false,
      error: "Chromium preview runs in the renderer via HTMLVideoElement",
    };
  }

  async decodeFrameAt(_timeSec: number): Promise<PreviewFrameResult> {
    return {
      ok: false,
      width: 0,
      height: 0,
      sourceTimeSec: _timeSec,
      error: "Chromium preview runs in the renderer via HTMLVideoElement",
    };
  }

  async close(): Promise<PreviewCloseResult> {
    return { ok: true };
  }
}
