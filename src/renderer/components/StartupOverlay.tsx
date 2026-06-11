import type { StartupStage } from "../hooks/useAppStartup";

type StartupOverlayProps = {
  stage: StartupStage;
  stageLabel: string;
  visible: boolean;
  fading?: boolean;
  isSlow: boolean;
  error: string | null;
  canContinueAnyway: boolean;
  onRetry: () => void;
  onContinueAnyway: () => void;
};

export default function StartupOverlay({
  stage,
  stageLabel,
  visible,
  fading = false,
  isSlow,
  error,
  canContinueAnyway,
  onRetry,
  onContinueAnyway,
}: StartupOverlayProps) {
  if (!visible && !fading) {
    return null;
  }

  const isError = stage === "error";

  return (
    <div
      className={`startup-overlay ${fading ? "startup-overlay-fading" : ""} ${
        isError ? "startup-overlay-error" : ""
      }`}
      role={isError ? "alertdialog" : "status"}
      aria-busy={!isError}
      aria-live="polite"
    >
      <div className="startup-overlay-card">
        {isError ? (
          <>
            <h1 className="startup-overlay-title">Startup failed</h1>
            <p className="startup-overlay-error-text">
              {error ?? "The application could not finish loading."}
            </p>
            <div className="startup-overlay-actions">
              <button type="button" className="btn btn-primary" onClick={onRetry}>
                Retry
              </button>
              {canContinueAnyway && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onContinueAnyway}
                >
                  Continue anyway
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="startup-overlay-spinner" aria-hidden="true" />
            <h1 className="startup-overlay-title">Starting FFmpeg Studio…</h1>
            <p className="startup-overlay-subtitle">
              Please wait while the app loads components
            </p>
            <p className="startup-overlay-stage">{stageLabel}</p>
            {isSlow && (
              <div className="startup-overlay-slow">
                <p>This is taking longer than usual…</p>
                <p>FFmpeg filter scan may take a moment</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
