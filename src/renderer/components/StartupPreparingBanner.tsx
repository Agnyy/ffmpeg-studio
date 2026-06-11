type StartupPreparingBannerProps = {
  filtersLoading: boolean;
  ffmpegChecking: boolean;
  ffmpegError?: string | null;
  compact?: boolean;
};

export default function StartupPreparingBanner({
  filtersLoading,
  ffmpegChecking,
  ffmpegError,
  compact = false,
}: StartupPreparingBannerProps) {
  if (!filtersLoading && !ffmpegChecking && !ffmpegError) {
    return null;
  }

  if (ffmpegError && !ffmpegChecking && !filtersLoading) {
    return (
      <div className={`startup-preparing-banner error ${compact ? "compact" : ""}`} role="alert">
        <strong>FFmpeg not found</strong>
        <p>Open Settings to configure the FFmpeg path.</p>
      </div>
    );
  }

  return (
    <div className={`startup-preparing-banner ${compact ? "compact" : ""}`} role="status">
      <strong>{compact ? "Loading FFmpeg filters…" : "Preparing FFmpeg Studio…"}</strong>
      <p>
        {compact
          ? "This usually takes a few seconds."
          : "Checking FFmpeg and available filters. This usually takes a few seconds."}
      </p>
    </div>
  );
}
