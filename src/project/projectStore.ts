import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import path from "path";
import { app } from "electron";
import type { FFmpegStudioProject } from "../shared/projectDocument";
import { migrateProject } from "../shared/projectDocument";

function getAutosaveDir(): string {
  const dir = path.join(app.getPath("userData"), "autosave");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getAutosaveFilePath(projectId: string): string {
  return path.join(getAutosaveDir(), `${projectId}.autosave.ffstudio`);
}

export function saveProjectToFile(filePath: string, project: FFmpegStudioProject): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(project, null, 2), "utf8");
}

export function loadProjectFromFile(filePath: string): FFmpegStudioProject {
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const project = migrateProject(parsed);
  return { ...project, projectPath: filePath };
}

function readAutosaveProject(filePath: string): FFmpegStudioProject | null {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const project = migrateProject(parsed);
    if (!project.projectPath) {
      return null;
    }
    return project;
  } catch {
    return null;
  }
}

export function saveAutosave(project: FFmpegStudioProject): void {
  if (!project.projectPath) {
    return;
  }
  const filePath = getAutosaveFilePath(project.projectId);
  saveProjectToFile(filePath, {
    ...project,
    updatedAt: new Date().toISOString(),
  });
}

export function loadAutosave(projectId?: string): FFmpegStudioProject | null {
  if (projectId) {
    const filePath = getAutosaveFilePath(projectId);
    if (!existsSync(filePath)) {
      return null;
    }
    return readAutosaveProject(filePath);
  }

  const dir = getAutosaveDir();
  if (!existsSync(dir)) {
    return null;
  }

  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".autosave.ffstudio"))
    .map((name) => path.join(dir, name))
    .map((filePath) => ({
      filePath,
      mtime: statSync(filePath).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const file of files) {
    const project = readAutosaveProject(file.filePath);
    if (project) {
      return project;
    }
    if (existsSync(file.filePath)) {
      unlinkSync(file.filePath);
    }
  }

  return null;
}

export function clearAutosave(projectId: string): void {
  const filePath = getAutosaveFilePath(projectId);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

export function checkMediaPathsExist(
  paths: string[]
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const filePath of paths) {
    result[filePath] = existsSync(filePath);
  }
  return result;
}

export type MediaFileStats = {
  exists: boolean;
  sizeBytes: number;
};

export function deleteMediaPaths(paths: string[]): { deleted: string[]; failed: string[] } {
  const deleted: string[] = [];
  const failed: string[] = [];
  for (const filePath of paths) {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        deleted.push(filePath);
      }
    } catch {
      failed.push(filePath);
    }
  }
  return { deleted, failed };
}

export function getMediaFileStats(
  paths: string[]
): Record<string, MediaFileStats> {
  const result: Record<string, MediaFileStats> = {};
  for (const filePath of paths) {
    if (!existsSync(filePath)) {
      result[filePath] = { exists: false, sizeBytes: 0 };
      continue;
    }
    result[filePath] = {
      exists: true,
      sizeBytes: statSync(filePath).size,
    };
  }
  return result;
}
