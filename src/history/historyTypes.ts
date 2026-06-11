import type { EditorStateSnapshot } from "../shared/projectDocument";

export type HistoryState = {
  past: EditorStateSnapshot[];
  present: EditorStateSnapshot;
  future: EditorStateSnapshot[];
};

export const DEFAULT_HISTORY_LIMIT = 50;
