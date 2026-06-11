const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mkv",
  "mov",
  "avi",
  "webm",
  "flv",
  "wmv",
  "m4v",
  "mpg",
  "mpeg",
]);

export function isVideoPath(filePath: string): boolean {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  const dot = base.lastIndexOf(".");
  if (dot < 0) {
    return false;
  }
  return VIDEO_EXTENSIONS.has(base.slice(dot + 1).toLowerCase());
}

export function filterVideoPaths(paths: string[]): string[] {
  return paths.filter(isVideoPath);
}
