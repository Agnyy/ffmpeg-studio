import type { ClipEditState } from "./clipEdit";
import {
  ensureLayerEditDefaults,
  ensureLayerEffects,
  ensureLayerKeyframes,
  ensureLayerTransform,
  type ProjectItem,
  type TimelineLayer,
} from "./project";
import type { CompRuntimeState } from "./compRuntime";
import {
  compRuntimeFromComposition,
  emptyCompRuntime,
  migrateCompositionName,
} from "./compRuntime";

export const CURRENT_PROJECT_VERSION = 1;
export const PROJECT_APP_NAME = "FFmpeg Studio" as const;

export type RenderRange = "full" | "workArea" | "selectedLayer";

export type ExportSettings = {
  exportCrf: number;
  exportPreset: string;
  exportAudioBitrate?: string;
  renderRange?: RenderRange;
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  exportCrf: 23,
  exportPreset: "medium",
  exportAudioBitrate: "128k",
  renderRange: "full",
};

export type Composition = {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  layers: TimelineLayer[];
  selectedLayerId?: string;
  currentTime: number;
  workAreaStart: number;
  workAreaEnd: number;
};

export type FFmpegStudioProject = {
  version: number;
  appName: typeof PROJECT_APP_NAME;
  projectName: string;
  projectPath?: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  mediaItems: ProjectItem[];
  compositions: Composition[];
  activeCompositionId?: string;
  clipEdits: Record<string, ClipEditState>;
  exportSettings: ExportSettings;
};

export type EditorStateSnapshot = {
  mediaItems: ProjectItem[];
  compositions: Composition[];
  activeCompositionId?: string;
  selectedLayerId?: string;
  selectedProjectItemId?: string;
  clipEdits: Record<string, ClipEditState>;
  exportSettings: ExportSettings;
};

export function createEmptySnapshot(): EditorStateSnapshot {
  return {
    mediaItems: [],
    compositions: [],
    activeCompositionId: undefined,
    selectedLayerId: undefined,
    selectedProjectItemId: undefined,
    clipEdits: {},
    exportSettings: { ...DEFAULT_EXPORT_SETTINGS },
  };
}

export function createProjectId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function migrateProject(raw: unknown): FFmpegStudioProject {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid project file");
  }

  const data = raw as Partial<FFmpegStudioProject>;

  if (!data.version) {
    throw new Error("Missing project version");
  }

  if (data.version !== CURRENT_PROJECT_VERSION) {
    throw new Error(`Unsupported project version: ${data.version}`);
  }

  if (data.appName !== PROJECT_APP_NAME) {
    throw new Error("Not a FFmpeg Studio project file");
  }

  return data as FFmpegStudioProject;
}

export function snapshotToProject(
  snapshot: EditorStateSnapshot,
  meta: {
    projectName: string;
    projectPath?: string;
    projectId: string;
    createdAt: string;
    updatedAt: string;
  }
): FFmpegStudioProject {
  return {
    version: CURRENT_PROJECT_VERSION,
    appName: PROJECT_APP_NAME,
    projectName: meta.projectName,
    projectPath: meta.projectPath,
    projectId: meta.projectId,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    mediaItems: snapshot.mediaItems.map(stripRuntimeMediaFields),
    compositions: snapshot.compositions.map((comp) => ({
      ...comp,
      layers: comp.layers.map((layer) =>
        ensureLayerEffects(
          ensureLayerTransform(layer, comp.width, comp.height)
        )
      ),
    })),
    activeCompositionId: snapshot.activeCompositionId,
    clipEdits: sanitizeClipEdits(snapshot.clipEdits),
    exportSettings: snapshot.exportSettings,
  };
}

export function projectToSnapshot(project: FFmpegStudioProject): EditorStateSnapshot {
  const activeComp =
    project.compositions.find((c) => c.id === project.activeCompositionId) ??
    project.compositions[0];

  return {
    mediaItems: project.mediaItems.map((item) => ({
      ...item,
      thumbnailUrl: undefined,
      thumbnailDataUrl: undefined,
    })),
    compositions: project.compositions,
    activeCompositionId: project.activeCompositionId ?? activeComp?.id,
    selectedLayerId: activeComp?.selectedLayerId,
    selectedProjectItemId: undefined,
    clipEdits: sanitizeClipEdits(project.clipEdits),
    exportSettings: project.exportSettings ?? { ...DEFAULT_EXPORT_SETTINGS },
  };
}

function stripRuntimeMediaFields(item: ProjectItem): ProjectItem {
  const {
    thumbnailUrl: _thumb,
    thumbnailDataUrl: _thumbData,
    thumbnailStatus: _thumbStatus,
    ...rest
  } = item;
  return rest;
}

function sanitizeClipEdits(
  clipEdits: Record<string, ClipEditState> | undefined
): Record<string, ClipEditState> {
  if (!clipEdits) {
    return {};
  }
  const next: Record<string, ClipEditState> = {};
  for (const [key, value] of Object.entries(clipEdits)) {
    next[key] = {
      ...value,
      currentTime: value.currentTime ?? 0,
    };
  }
  return next;
}

/** Migrates legacy per-sourcePath clipEdits into per-layer state. */
export function migrateLegacyClipEditsToLayers(
  layers: TimelineLayer[],
  clipEdits: Record<string, ClipEditState>,
  compWidth: number,
  compHeight: number
): TimelineLayer[] {
  const hasLegacyEdits = Object.keys(clipEdits).length > 0;

  return layers.map((layer) => {
    let next = ensureLayerKeyframes(
      ensureLayerEditDefaults(
        ensureLayerEffects(ensureLayerTransform(layer, compWidth, compHeight))
      )
    );
    if (!hasLegacyEdits) {
      return next;
    }

    const legacy = clipEdits[layer.sourcePath];
    if (!legacy) {
      return next;
    }

    return {
      ...next,
      cropEnabled: layer.cropEnabled ?? legacy.cropEnabled ?? false,
      crop: layer.crop ?? legacy.crop,
      aspectRatio: layer.aspectRatio ?? legacy.aspectRatio ?? "free",
      uniformScale: layer.uniformScale ?? legacy.uniformScale ?? true,
    };
  });
}

export function snapshotFromFlatState(input: {
  projectItems: ProjectItem[];
  timelineLayers: TimelineLayer[];
  compCurrentTime: number;
  activeCompositionId: string | null;
  selectedLayerId: string | null;
  selectedProjectItemId: string | null;
  exportSettings: ExportSettings;
  compositionDuration: number;
  workAreaStart: number;
  workAreaEnd: number;
  compStatesById?: Record<string, CompRuntimeState>;
}): EditorStateSnapshot {
  const mediaItems = input.projectItems
    .filter((item) => item.type === "footage")
    .map(stripRuntimeMediaFields);

  const compItems = input.projectItems.filter((item) => item.type === "composition");
  const activeId = input.activeCompositionId ?? compItems[0]?.id;

  const compStates = input.compStatesById ?? {};

  const compositions: Composition[] = compItems.map((item) => {
    const meta = item.composition;
    const isActive = item.id === activeId;
    const runtime = isActive
      ? {
          layers: input.timelineLayers,
          currentTime: input.compCurrentTime,
          workAreaStart: input.workAreaStart,
          workAreaEnd: input.workAreaEnd,
          selectedLayerId: input.selectedLayerId,
        }
      : (compStates[item.id] ??
        emptyCompRuntime(meta?.duration ?? input.compositionDuration));

    const layers = runtime.layers.map((layer) =>
      ensureLayerEditDefaults(
        ensureLayerEffects(
          ensureLayerTransform(layer, meta?.width ?? 1280, meta?.height ?? 720)
        )
      )
    );

    return {
      id: item.id,
      name: migrateCompositionName(item.name),
      width: meta?.width ?? 1280,
      height: meta?.height ?? 720,
      fps: meta?.fps ?? 30,
      duration: meta?.duration ?? input.compositionDuration,
      layers,
      selectedLayerId: runtime.selectedLayerId ?? undefined,
      currentTime: runtime.currentTime,
      workAreaStart: runtime.workAreaStart,
      workAreaEnd: runtime.workAreaEnd,
    };
  });

  return {
    mediaItems,
    compositions,
    activeCompositionId: activeId ?? undefined,
    selectedLayerId: input.selectedLayerId ?? undefined,
    selectedProjectItemId: input.selectedProjectItemId ?? undefined,
    clipEdits: {},
    exportSettings: input.exportSettings,
  };
}

export function editorFlatFromSnapshot(snapshot: EditorStateSnapshot): FlatEditorState {
  const activeComp =
    snapshot.compositions.find((c) => c.id === snapshot.activeCompositionId) ??
    snapshot.compositions[0];

  const legacyClipEdits = sanitizeClipEdits(snapshot.clipEdits);
  const compStatesById: Record<string, CompRuntimeState> = {};
  const compositionItems: ProjectItem[] = snapshot.compositions.map((comp) => {
    const migratedLayers = migrateLegacyClipEditsToLayers(
      comp.layers,
      legacyClipEdits,
      comp.width,
      comp.height
    );
    compStatesById[comp.id] = compRuntimeFromComposition({
      layers: migratedLayers,
      currentTime: comp.currentTime,
      workAreaStart: comp.workAreaStart,
      workAreaEnd: comp.workAreaEnd,
      selectedLayerId: comp.selectedLayerId,
      duration: comp.duration,
    });
    return {
      id: comp.id,
      type: "composition" as const,
      name: migrateCompositionName(comp.name),
      composition: {
        width: comp.width,
        height: comp.height,
        fps: comp.fps,
        duration: comp.duration,
      },
    };
  });

  const legacyCurrentTime = Object.values(legacyClipEdits)[0]?.currentTime;
  const activeRuntime =
    activeComp && compStatesById[activeComp.id]
      ? compStatesById[activeComp.id]
      : emptyCompRuntime(activeComp?.duration ?? 0);

  return {
    projectItems: [...snapshot.mediaItems, ...compositionItems],
    timelineLayers: activeRuntime.layers,
    compCurrentTime: activeRuntime.currentTime || legacyCurrentTime || 0,
    activeCompositionId: activeComp?.id ?? null,
    selectedLayerId: snapshot.selectedLayerId ?? activeRuntime.selectedLayerId,
    selectedProjectItemId: snapshot.selectedProjectItemId ?? null,
    exportSettings: snapshot.exportSettings ?? { ...DEFAULT_EXPORT_SETTINGS },
    compositionDuration: activeComp?.duration ?? 0,
    workAreaStart: activeRuntime.workAreaStart,
    workAreaEnd: activeRuntime.workAreaEnd,
    compStatesById,
  };
}

export type FlatEditorState = {
  projectItems: ProjectItem[];
  timelineLayers: TimelineLayer[];
  compCurrentTime: number;
  activeCompositionId: string | null;
  selectedLayerId: string | null;
  selectedProjectItemId: string | null;
  exportSettings: ExportSettings;
  compositionDuration: number;
  workAreaStart: number;
  workAreaEnd: number;
  compStatesById?: Record<string, CompRuntimeState>;
};

export function snapshotsEqual(a: EditorStateSnapshot, b: EditorStateSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
