export function buildThumbnailPipeArgs(
  inputPath: string,
  timeSec = 0
): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(Math.max(0, timeSec)),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-f",
    "image2pipe",
    "-vcodec",
    "mjpeg",
    "-",
  ];
}
