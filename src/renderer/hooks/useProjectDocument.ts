import { useCallback, useEffect, useRef, useState } from "react";
import { createHistoryStore, type HistoryStore } from "../../history/historyStore";
import {
  createEmptySnapshot,
  createProjectId,
  editorFlatFromSnapshot,
  snapshotFromFlatState,
  snapshotToProject,
  type EditorStateSnapshot,
  type FlatEditorState,
} from "../../shared/projectDocument";
import type { ProjectItem, TimelineLayer } from "../../shared/project";
import { rebuildJobsFromState } from "../utils/editorProject";
import type { Job } from "../../shared/types";

export type SaveStatus = "saved" | "unsaved" | "autosaved";

export type ProjectDocumentApi = {
  projectName: string;
  projectPath: string | null;
  isDirty: boolean;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  setProjectName: (name: string) => void;
  markDirty: () => void;
  markSaved: () => void;
  markAutosaved: () => void;
  captureSnapshot: (state: FlatEditorState) => EditorStateSnapshot;
  applySnapshot: (snapshot: EditorStateSnapshot) => FlatEditorState;
  pushHistory: (state: FlatEditorState) => void;
  beginHistoryTransaction: () => void;
  commitHistoryTransaction: (state: FlatEditorState) => void;
  undo: (state: FlatEditorState) => EditorStateSnapshot | null;
  redo: (state: FlatEditorState) => EditorStateSnapshot | null;
  replaceHistory: (state: FlatEditorState) => void;
  buildProjectFile: (state: FlatEditorState) => import("../../shared/projectDocument").FFmpegStudioProject;
  confirmDiscardChanges: () => Promise<"save" | "discard" | "cancel">;
};

type UseProjectDocumentOptions = {
  projectId: string;
  createdAt: string;
};

export function useProjectDocument({
  projectId: initialProjectId,
  createdAt: initialCreatedAt,
}: UseProjectDocumentOptions): ProjectDocumentApi & {
  projectId: string;
  createdAt: string;
  setProjectMeta: (meta: { projectId?: string; createdAt?: string; projectPath?: string | null; projectName?: string }) => void;
} {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [createdAt, setCreatedAt] = useState(initialCreatedAt);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [historyTick, setHistoryTick] = useState(0);

  const historyRef = useRef<HistoryStore>(createHistoryStore(createEmptySnapshot()));

  const bumpHistory = useCallback(() => {
    setHistoryTick((value) => value + 1);
  }, []);

  const captureSnapshot = useCallback(
    (state: FlatEditorState): EditorStateSnapshot =>
      snapshotFromFlatState({
        projectItems: state.projectItems,
        timelineLayers: state.timelineLayers,
        compCurrentTime: state.compCurrentTime,
        activeCompositionId: state.activeCompositionId,
        selectedLayerId: state.selectedLayerId,
        selectedProjectItemId: state.selectedProjectItemId,
        exportSettings: state.exportSettings,
        compositionDuration: state.compositionDuration,
        workAreaStart: state.workAreaStart,
        workAreaEnd: state.workAreaEnd,
        compStatesById: state.compStatesById,
      }),
    []
  );

  const applySnapshot = useCallback((snapshot: EditorStateSnapshot): FlatEditorState => {
    return editorFlatFromSnapshot(snapshot);
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setSaveStatus("unsaved");
  }, []);

  const markSaved = useCallback(() => {
    setIsDirty(false);
    setSaveStatus("saved");
  }, []);

  const markAutosaved = useCallback(() => {
    setSaveStatus("autosaved");
  }, []);

  const pushHistory = useCallback(
    (state: FlatEditorState) => {
      historyRef.current.push(captureSnapshot(state));
      markDirty();
      bumpHistory();
    },
    [bumpHistory, captureSnapshot, markDirty]
  );

  const beginHistoryTransaction = useCallback(() => {
    historyRef.current.beginTransaction();
  }, []);

  const commitHistoryTransaction = useCallback(
    (state: FlatEditorState) => {
      historyRef.current.commitTransaction(captureSnapshot(state));
      markDirty();
      bumpHistory();
    },
    [bumpHistory, captureSnapshot, markDirty]
  );

  const undo = useCallback(
    (state: FlatEditorState) => {
      historyRef.current.commitTransaction(captureSnapshot(state));
      const snapshot = historyRef.current.undo();
      if (snapshot) {
        markDirty();
        bumpHistory();
      }
      return snapshot;
    },
    [bumpHistory, captureSnapshot, markDirty]
  );

  const redo = useCallback(
    (_state: FlatEditorState) => {
      const snapshot = historyRef.current.redo();
      if (snapshot) {
        markDirty();
        bumpHistory();
      }
      return snapshot;
    },
    [bumpHistory, markDirty]
  );

  const replaceHistory = useCallback(
    (state: FlatEditorState) => {
      historyRef.current.replaceAll(captureSnapshot(state));
      bumpHistory();
    },
    [bumpHistory, captureSnapshot]
  );

  const buildProjectFile = useCallback(
    (state: FlatEditorState) => {
      const snapshot = captureSnapshot(state);
      return snapshotToProject(snapshot, {
        projectName,
        projectPath: projectPath ?? undefined,
        projectId,
        createdAt,
        updatedAt: new Date().toISOString(),
      });
    },
    [captureSnapshot, createdAt, projectId, projectName, projectPath]
  );

  const confirmDiscardChanges = useCallback(async () => {
    if (!isDirty) {
      return "discard" as const;
    }
    return window.ffmpegStudio.confirmUnsaved(
      "Save changes before continuing?"
    );
  }, [isDirty]);

  const setProjectMeta = useCallback(
    (meta: {
      projectId?: string;
      createdAt?: string;
      projectPath?: string | null;
      projectName?: string;
    }) => {
      if (meta.projectId) {
        setProjectId(meta.projectId);
      }
      if (meta.createdAt) {
        setCreatedAt(meta.createdAt);
      }
      if (meta.projectPath !== undefined) {
        setProjectPath(meta.projectPath);
      }
      if (meta.projectName) {
        setProjectName(meta.projectName);
      }
    },
    []
  );

  useEffect(() => {
    const title = `${projectName}${isDirty ? " *" : ""} — FFmpeg Studio`;
    window.ffmpegStudio.setWindowTitle(title);
  }, [projectName, isDirty, historyTick]);

  return {
    projectId,
    createdAt,
    projectName,
    projectPath,
    isDirty,
    saveStatus,
    canUndo: historyRef.current.canUndo(),
    canRedo: historyRef.current.canRedo(),
    setProjectName,
    markDirty,
    markSaved,
    markAutosaved,
    captureSnapshot: (state: FlatEditorState) => captureSnapshot(state),
    applySnapshot,
    pushHistory,
    beginHistoryTransaction,
    commitHistoryTransaction,
    undo,
    redo,
    replaceHistory,
    buildProjectFile,
    confirmDiscardChanges,
    setProjectMeta,
  };
}

export function createInitialProjectMeta() {
  return {
    projectId: createProjectId(),
    createdAt: new Date().toISOString(),
  };
}

export function flatStateFromEditor(input: {
  projectItems: ProjectItem[];
  timelineLayers: TimelineLayer[];
  compCurrentTime: number;
  activeCompositionId: string | null;
  selectedLayerId: string | null;
  selectedProjectItemId: string | null;
  exportSettings: import("../../shared/projectDocument").ExportSettings;
  compositionDuration: number;
  workAreaStart: number;
  workAreaEnd: number;
  compStatesById?: Record<string, import("../../shared/compRuntime").CompRuntimeState>;
}): FlatEditorState {
  return input;
}

export function rebuildEditorFromFlat(
  flat: FlatEditorState,
  compWidth: number,
  compHeight: number,
  mediaDimensions: Record<string, { width: number; height: number }> = {}
): {
  projectItems: ProjectItem[];
  timelineLayers: TimelineLayer[];
  jobs: Job[];
} {
  const jobs = rebuildJobsFromState(
    flat.timelineLayers,
    compWidth,
    compHeight,
    flat.exportSettings,
    mediaDimensions
  );
  return {
    projectItems: flat.projectItems,
    timelineLayers: flat.timelineLayers,
    jobs,
  };
}
