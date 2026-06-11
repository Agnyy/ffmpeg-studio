export function getDirname(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return index >= 0 ? filePath.slice(0, index) : "";
}

export function getBasename(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return index >= 0 ? filePath.slice(index + 1) : filePath;
}

export function getExtension(filePath: string): string {
  const base = getBasename(filePath);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot) : "";
}

export function getBasenameWithoutExtension(filePath: string): string {
  const base = getBasename(filePath);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(0, dot) : base;
}

export function joinPath(dir: string, filename: string): string {
  const separator = dir.includes("\\") ? "\\" : "/";
  if (!dir) {
    return filename;
  }
  if (dir.endsWith("/") || dir.endsWith("\\")) {
    return `${dir}${filename}`;
  }
  return `${dir}${separator}${filename}`;
}
