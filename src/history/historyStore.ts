import type { EditorStateSnapshot } from "../shared/projectDocument";
import { snapshotsEqual } from "../shared/projectDocument";
import { DEFAULT_HISTORY_LIMIT } from "./historyTypes";

function cloneSnapshot(snapshot: EditorStateSnapshot): EditorStateSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as EditorStateSnapshot;
}

export type HistoryStore = {
  getPresent: () => EditorStateSnapshot;
  canUndo: () => boolean;
  canRedo: () => boolean;
  push: (next: EditorStateSnapshot) => void;
  beginTransaction: () => void;
  commitTransaction: (next: EditorStateSnapshot) => void;
  cancelTransaction: () => void;
  undo: () => EditorStateSnapshot | null;
  redo: () => EditorStateSnapshot | null;
  replaceAll: (next: EditorStateSnapshot) => void;
};

export function createHistoryStore(
  initial: EditorStateSnapshot,
  limit = DEFAULT_HISTORY_LIMIT
): HistoryStore {
  let past: EditorStateSnapshot[] = [];
  let present = cloneSnapshot(initial);
  let future: EditorStateSnapshot[] = [];
  let transactionStart: EditorStateSnapshot | null = null;

  return {
    getPresent: () => present,

    canUndo: () => past.length > 0,

    canRedo: () => future.length > 0,

    push(next) {
      if (snapshotsEqual(present, next)) {
        return;
      }
      if (transactionStart) {
        present = cloneSnapshot(next);
        return;
      }
      past.push(cloneSnapshot(present));
      if (past.length > limit) {
        past.shift();
      }
      present = cloneSnapshot(next);
      future = [];
    },

    beginTransaction() {
      transactionStart = cloneSnapshot(present);
    },

    commitTransaction(next) {
      if (transactionStart && !snapshotsEqual(transactionStart, next)) {
        past.push(transactionStart);
        if (past.length > limit) {
          past.shift();
        }
        present = cloneSnapshot(next);
        future = [];
      }
      transactionStart = null;
    },

    cancelTransaction() {
      transactionStart = null;
    },

    undo() {
      if (past.length === 0) {
        return null;
      }
      future.unshift(cloneSnapshot(present));
      present = past.pop()!;
      transactionStart = null;
      return cloneSnapshot(present);
    },

    redo() {
      if (future.length === 0) {
        return null;
      }
      past.push(cloneSnapshot(present));
      present = future.shift()!;
      transactionStart = null;
      return cloneSnapshot(present);
    },

    replaceAll(next) {
      past = [];
      present = cloneSnapshot(next);
      future = [];
      transactionStart = null;
    },
  };
}
