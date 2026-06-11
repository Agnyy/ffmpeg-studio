import type { ProjectItem } from "../../shared/project";
import type { Job } from "../../shared/types";
import { isPreviewUnsupported, normalizeCompatibilityStatus } from "../../media/mediaCompatibility";
import { getFootagePreviewStatusLabel, needsManualProxyRetry } from "../../media/previewState";

type MediaPreviewDiagnosticsProps = {
  item: ProjectItem | null;
  sourcePath: string | null;
  previewError?: string | null;
  isGeneratingProxy?: boolean;
  proxyJob?: Job | null;
  onCreateProxy?: (itemId: string) => void;
  prominent?: boolean;
};

export default function MediaPreviewDiagnostics({
  item,
  sourcePath,
  previewError,
  isGeneratingProxy,
  proxyJob,
  onCreateProxy,
  prominent = false,
}: MediaPreviewDiagnosticsProps) {
  if (!item || item.type !== "footage" || !sourcePath) {
    return null;
  }

  const status = normalizeCompatibilityStatus(item.compatibilityStatus);
  const generating =
    Boolean(isGeneratingProxy) || status === "proxy-generating";
  const needsProxy = isPreviewUnsupported(item) || Boolean(previewError);
  const showStatusPanel =
    Boolean(previewError) ||
    needsProxy ||
    generating ||
    status === "checking-preview" ||
    status === "proxy-failed";

  const showRetryButton =
    needsManualProxyRetry(item) &&
    !generating &&
    status !== "checking-preview" &&
    Boolean(onCreateProxy);

  const proxyProgressValue =
    proxyJob && proxyJob.status === "done"
      ? 100
      : proxyJob && proxyJob.progress > 0
        ? proxyJob.progress
        : 0;
  const proxyProgressIndeterminate =
    Boolean(proxyJob) && proxyJob!.status === "running" && proxyJob!.progress === 0;

  const statusTitle = getFootagePreviewStatusLabel(item, { isGeneratingProxy: generating });

  if (!showStatusPanel) {
    return null;
  }

  return (
    <div
      className={`media-preview-diagnostics ${prominent ? "media-preview-diagnostics-prominent" : ""}`}
    >
      {status === "checking-preview" ? (
            <>
              <h4 className="media-preview-diagnostics-title">Checking preview support…</h4>
              <p className="media-preview-diagnostics-text">
                Testing whether Electron can decode this file for preview.
              </p>
            </>
          ) : generating ? (
            <>
              <h4 className="media-preview-diagnostics-title">Creating preview proxy…</h4>
              <p className="media-preview-diagnostics-progress">
                Building an H.264 preview file. Progress is also shown in Tasks.
              </p>
              <div className="progress-inline">
                <div className="progress-bar-track">
                  <div
                    className={`progress-bar-fill ${proxyProgressIndeterminate ? "indeterminate" : ""}`}
                    style={{ width: `${proxyProgressValue}%` }}
                  />
                </div>
                <span className="progress-text">
                  {proxyProgressIndeterminate ? "…" : `${Math.round(proxyProgressValue)}%`}
                </span>
              </div>
            </>
          ) : status === "proxy-failed" ? (
            <>
              <h4 className="media-preview-diagnostics-title">Proxy failed</h4>
              <p className="media-preview-diagnostics-text">
                {item.compatibilityReason ?? "Could not create a preview proxy for this file."}
              </p>
            </>
          ) : needsProxy ? (
            <>
              <h4 className="media-preview-diagnostics-title">
                Preview unsupported for this file
              </h4>
              <p className="media-preview-diagnostics-text">
                Electron cannot decode this video directly. You can still render it with FFmpeg.
              </p>
            </>
          ) : previewError ? (
            <>
              <h4 className="media-preview-diagnostics-title">{statusTitle}</h4>
              <p className="media-preview-diagnostics-text">{previewError}</p>
            </>
          ) : null}

          {(previewError || item.compatibilityReason) && status !== "proxy-failed" && (
            <p className="media-preview-diagnostics-text">
              {previewError ?? item.compatibilityReason}
            </p>
          )}

      {showRetryButton && (
        <button
          type="button"
          className={`btn btn-primary ${prominent ? "" : "btn-sm"}`}
          onClick={() => onCreateProxy!(item.id)}
        >
          {status === "proxy-failed" ? "Retry Proxy" : "Create Preview Proxy"}
        </button>
      )}
    </div>
  );
}
