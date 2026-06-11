import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { app } from "electron";
import type { Settings } from "../shared/types";
import { DEFAULT_SETTINGS } from "./settingsTypes";

function getSettingsPath(): string {
  const userData = app.getPath("userData");
  return path.join(userData, "settings.json");
}

export function loadSettings(): Settings {
  const settingsPath = getSettingsPath();

  if (!existsSync(settingsPath)) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const raw = readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  const settingsPath = getSettingsPath();
  mkdirSync(path.dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
}
