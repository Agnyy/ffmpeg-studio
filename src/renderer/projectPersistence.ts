import type { FFmpegStudioProject, FlatEditorState } from "../shared/projectDocument";
import {
  DEFAULT_EXPORT_SETTINGS,
  editorFlatFromSnapshot,
  projectToSnapshot,
} from "../shared/projectDocument";
import type { ProjectItem, TimelineLayer } from "../shared/project";
import { getBasename } from "../shared/pathUtils";
import type { Job, MediaInfo } from "../shared/types";
import { flatStateFromEditor } from "./hooks/useProjectDocument";
import {
  createFootageProjectItem,
  syncFootageChromiumQuarantine,
  validateProxyPaths,
} from "../media/mediaCompatibility";
import { clearNativePreviewCacheForPath } from "../media/nativePreviewCache";
import { updateLayersAfterRelink } from "./utils/editorProject";

export async function validateMediaItems(items: ProjectItem[]): Promise<ProjectItem[]> {
  const paths = items
    .filter((item) => item.type === "footage" && item.path)
    .map((item) => item.path!);

  let next = items;
  if (paths.length > 0) {
    const exists = await window.ffmpegStudio.checkMediaPaths(paths);
    next = items.map((item) => {
      if (item.type !== "footage" || !item.path) {
        return item;
      }
      if (!exists[item.path]) {
        return {
          ...item,
          missing: true,
          thumbnailUrl: undefined,
          thumbnailDataUrl: undefined,
          thumbnailStatus: undefined,
        };
      }
      return {
        ...item,
        missing: false,
        originalPath: item.originalPath ?? item.path,
      };
    });
  }

  const validated = await validateProxyPaths(next);
  return validated.map(syncFootageChromiumQuarantine);
}

export async function attachThumbnailsToItems(items: ProjectItem[]): Promise<ProjectItem[]> {
  return items;
}

export function mediaDimensionsFromItems(
  items: ProjectItem[]
): Record<string, { width: number; height: number }> {
  const map: Record<string, { width: number; height: number }> = {};
  for (const item of items) {
    if (item.type === "footage" && item.path && item.mediaInfo?.width && item.mediaInfo?.height) {
      map[item.path] = {
        width: item.mediaInfo.width,
        height: item.mediaInfo.height,
      };
    }
  }
  return map;
}

export async function probeLoadedMedia(
  items: ProjectItem[],
  probeFile: (path: string) => Promise<MediaInfo | null | undefined>
): Promise<ProjectItem[]> {
  let next = items;
  for (const item of items) {
    if (item.type !== "footage" || !item.path || item.missing || item.mediaInfo) {
      continue;
    }
    try {
      const mediaInfo = await probeFile(item.path);
      if (mediaInfo) {
        next = next.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                mediaInfo,
                name: getBasename(item.path!),
                compatibilityStatus: entry.compatibilityStatus ?? "imported",
              }
            : entry
        );
      }
    } catch {
      // keep item without mediaInfo
    }
  }
  return next;
}

export function flatFromAppState(input: {
  projectItems: ProjectItem[];
  timelineLayers: TimelineLayer[];
  compCurrentTime: number;
  activeCompositionId: string | null;
  selectedLayerId: string | null;
  selectedProjectItemId: string | null;
  exportSettings: FlatEditorState["exportSettings"];
  compositionDuration: number;
  workAreaStart: number;
  workAreaEnd: number;
  compStatesById?: FlatEditorState["compStatesById"];
}): FlatEditorState {
  return flatStateFromEditor(input);
}

export function flatFromLoadedProject(project: FFmpegStudioProject): FlatEditorState {
  return editorFlatFromSnapshot(projectToSnapshot(project));
}

export function createDefaultFlatEditorState(): FlatEditorState {
  return {
    projectItems: [],
    timelineLayers: [],
    compCurrentTime: 0,
    activeCompositionId: null,
    selectedLayerId: null,
    selectedProjectItemId: null,
    exportSettings: { ...DEFAULT_EXPORT_SETTINGS },
    compositionDuration: 0,
    workAreaStart: 0,
    workAreaEnd: 0,
  };
}

export function relinkFootageInState(input: {
  projectItems: ProjectItem[];
  timelineLayers: TimelineLayer[];
  jobs: Job[];
  itemId: string;
  newPath: string;
  mediaInfo: MediaInfo | null | undefined;
}): {
  projectItems: ProjectItem[];
  timelineLayers: TimelineLayer[];
  jobs: Job[];
} {
  const existing = input.projectItems.find((item) => item.id === input.itemId);
  const oldPath = existing?.path;
  if (!existing || existing.type !== "footage" || !oldPath) {
    return input;
  }

  clearNativePreviewCacheForPath(oldPath);

  const relinkedItem: ProjectItem = {
    ...createFootageProjectItem({
      id: existing.id,
      path: input.newPath,
      name: getBasename(input.newPath),
      mediaInfo: input.mediaInfo ?? undefined,
      probeError: input.mediaInfo ? undefined : "FFprobe could not read file metadata",
    }),
    proxyPath: undefined,
    previewPath: undefined,
    thumbnailUrl: undefined,
    thumbnailDataUrl: undefined,
    thumbnailStatus: "not-started",
  };

  return {
    projectItems: input.projectItems.map((item) =>
      item.id === input.itemId ? relinkedItem : item
    ),
    timelineLayers: updateLayersAfterRelink(
      input.timelineLayers,
      input.itemId,
      oldPath,
      input.newPath
    ),
    jobs: input.jobs.map((job) =>
      job.inputPath === oldPath ? { ...job, inputPath: input.newPath } : job
    ),
  };
}
