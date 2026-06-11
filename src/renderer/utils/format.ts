export function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds <= 0) {
    return "-";
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatResolution(width?: number, height?: number): string {
  if (!width || !height) {
    return "-";
  }
  return `${width} x ${height}`;
}

export function formatBitrate(bitrate?: number): string {
  if (!bitrate) {
    return "-";
  }
  if (bitrate >= 1_000_000) {
    return `${(bitrate / 1_000_000).toFixed(1)} Mbps`;
  }
  return `${Math.round(bitrate / 1000)} kbps`;
}

export function formatFps(fps?: number): string {
  if (!fps) {
    return "-";
  }
  return `${fps.toFixed(2)} fps`;
}
