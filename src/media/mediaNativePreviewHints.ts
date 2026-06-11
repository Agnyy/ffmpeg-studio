import type { MediaInfo } from "../shared/types";

/** Pixel formats Chromium/Electron often cannot decode in &lt;video&gt;. */
const RISKY_PIXEL_FORMATS = new Set([
  "yuv444p10le",
  "yuv422p10le",
  "yuv420p10le",
  "yuv444p12le",
  "yuv422p12le",
  "yuv420p12le",
  "yuv444p16le",
  "yuv422p16le",
  "yuv420p16le",
  "gbrp",
  "gbrap",
  "gbrap10le",
  "gbrap12le",
  "gbrap16le",
  "v410",
  "v210",
  "v308",
  "v408",
  "uyvy422",
  "yuyv422",
  "rgb48le",
  "rgba64le",
]);

/** Codecs that should use proxy without attempting Chromium decode. */
const RISKY_VIDEO_CODECS = new Set([
  "prores",
  "dnxhd",
  "cfhd",
  "v210",
  "rawvideo",
  "ffv1",
  "vvc",
]);

export function getNativePreviewSkipReason(mediaInfo?: MediaInfo): string | null {
  if (!mediaInfo) {
    return null;
  }

  const codec = mediaInfo.videoCodec?.toLowerCase();
  if (codec && RISKY_VIDEO_CODECS.has(codec)) {
    return `Video codec "${codec}" requires a preview proxy for Chromium playback`;
  }

  const pixFmt = mediaInfo.pixelFormat?.toLowerCase();
  if (pixFmt && RISKY_PIXEL_FORMATS.has(pixFmt)) {
    return `Pixel format "${pixFmt}" is not supported by Chromium preview`;
  }

  return null;
}
