import { destroyHtmlVideoElement } from "./chromiumQuarantine";
import { markNativePreviewFailed } from "./nativePreviewCache";
import { assignNativePreviewTestSource } from "./previewVideoDebug";

export type NativePreviewTestResult = {
  ok: boolean;
  error?: string;
  errorCode?: number;
};

function videoErrorMessage(video: HTMLVideoElement): string {
  const err = video.error;
  if (!err) {
    return "Native video preview failed";
  }
  const codeMessages: Record<number, string> = {
    1: "MEDIA_ERR_ABORTED",
    2: "MEDIA_ERR_NETWORK",
    3: "MEDIA_ERR_DECODE",
    4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
  };
  const label = codeMessages[err.code] ?? `MEDIA_ERR_${err.code}`;
  return err.message ? `${label}: ${err.message}` : label;
}

export async function testNativeVideoPreview(
  fileUrl: string,
  options?: { timeoutMs?: number; originalPath?: string }
): Promise<NativePreviewTestResult> {
  const timeoutMs = options?.timeoutMs ?? 6000;
  const originalPath = options?.originalPath;

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    let decodeProbeStarted = false;

    const finish = (result: NativePreviewTestResult) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      destroyHtmlVideoElement(video);
      resolve(result);
    };

    const fail = (result: NativePreviewTestResult) => {
      if (originalPath && !result.ok) {
        markNativePreviewFailed(
          originalPath,
          result.error ?? "Native preview failed"
        );
      }
      finish(result);
    };

    const timer = window.setTimeout(() => {
      fail({
        ok: false,
        error: `Native preview timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    video.addEventListener("error", () => {
      fail({
        ok: false,
        error: videoErrorMessage(video),
        errorCode: video.error?.code,
      });
    });

    video.addEventListener("loadedmetadata", () => {
      if (video.error) {
        fail({
          ok: false,
          error: videoErrorMessage(video),
          errorCode: video.error?.code,
        });
        return;
      }
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        fail({
          ok: false,
          error: "Video loaded but has no frame dimensions",
        });
        return;
      }

      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0.05) {
        finish({ ok: true });
        return;
      }

      decodeProbeStarted = true;
      const seekTarget = Math.min(Math.max(duration * 0.05, 0.01), duration - 0.01);
      video.currentTime = seekTarget;
    });

    video.addEventListener("seeked", () => {
      if (!decodeProbeStarted) {
        return;
      }
      if (video.error) {
        fail({
          ok: false,
          error: videoErrorMessage(video),
          errorCode: video.error?.code,
        });
        return;
      }
      finish({ ok: true });
    });

    if (!assignNativePreviewTestSource(video, fileUrl, originalPath)) {
      fail({
        ok: false,
        error: "Native preview check blocked for this path",
      });
    }
  });
}
