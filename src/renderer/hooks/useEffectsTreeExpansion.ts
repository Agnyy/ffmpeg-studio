import { useCallback, useEffect, useState } from "react";

export const EFFECTS_EXPANSION_STORAGE_KEY = "effectsPresetsExpandedFoldersV3";

const LEGACY_STORAGE_KEYS = [
  "effectsPresetsExpandedFolders",
  "effectsPresetsExpandedFoldersV2",
  "ffmpeg-studio-effects-tree-expanded",
] as const;

/** Default V3: every known folder closed. Unknown folders default to closed too. */
export const DEFAULT_EXPANSION_V3: Record<string, boolean> = {
  "smart-presets": false,
  "ffmpeg-filters": false,
  "smart-stabilization": false,
  "smart-cleanup": false,
  "smart-audio": false,
  "smart-social-media": false,
  "smart-compression": false,
  "smart-export": false,
  stabilization: false,
  cleanup: false,
  audio: false,
  color: false,
  "blur-&-sharpen": false,
  geometry: false,
};

function purgeLegacyExpansionKeys(): void {
  for (const key of LEGACY_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (
      key &&
      key !== EFFECTS_EXPANSION_STORAGE_KEY &&
      /effectsPresetsExpandedFolders/i.test(key)
    ) {
      localStorage.removeItem(key);
    }
  }
}

function parseV3Storage(raw: string): Set<string> {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return new Set();
  }
  const expanded = new Set<string>();
  for (const [folderId, value] of Object.entries(parsed)) {
    if (value === true) {
      expanded.add(folderId);
    }
  }
  return expanded;
}

function loadExpandedFromStorage(): Set<string> {
  purgeLegacyExpansionKeys();
  try {
    const raw = localStorage.getItem(EFFECTS_EXPANSION_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    return parseV3Storage(raw);
  } catch {
    return new Set();
  }
}

function saveExpandedToStorage(expanded: Set<string>): void {
  try {
    if (expanded.size === 0) {
      localStorage.removeItem(EFFECTS_EXPANSION_STORAGE_KEY);
      return;
    }
    const payload: Record<string, boolean> = { ...DEFAULT_EXPANSION_V3 };
    for (const folderId of Object.keys(DEFAULT_EXPANSION_V3)) {
      payload[folderId] = expanded.has(folderId);
    }
    for (const folderId of expanded) {
      payload[folderId] = true;
    }
    localStorage.setItem(EFFECTS_EXPANSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

export function resetEffectsFolderExpansion(): void {
  purgeLegacyExpansionKeys();
  localStorage.removeItem(EFFECTS_EXPANSION_STORAGE_KEY);
}

export function useEffectsTreeExpansion() {
  const [savedExpanded, setSavedExpanded] = useState<Set<string>>(loadExpandedFromStorage);

  useEffect(() => {
    saveExpandedToStorage(savedExpanded);
  }, [savedExpanded]);

  const toggleFolder = useCallback((folderId: string) => {
    setSavedExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const resetFolders = useCallback(() => {
    resetEffectsFolderExpansion();
    setSavedExpanded(new Set());
  }, []);

  return { savedExpanded, toggleFolder, resetFolders };
}
