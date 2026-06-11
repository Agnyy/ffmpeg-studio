import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { app } from "electron";
import { buildVidstabDetectArgs } from "./catalogEffectFilters";
import { runFfmpegAndWait } from "./ffmpegRunner";
import type { LayerEffect } from "../shared/effects";

export function getVidstabTrfPath(layerId: string, effectId: string): string {
  const dir = join(app.getPath("userData"), "analysis", "vidstab");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${layerId}_${effectId}.trf`);
}

export function vidstabAnalysisExists(path: string): boolean {
  return Boolean(path) && existsSync(path);
}

export async function runVidstabAnalysis(options: {
  ffmpegPath: string;
  inputPath: string;
  layerId: string;
  effect: LayerEffect;
}): Promise<{ trfPath: string; logs: string[] }> {
  const trfPath = getVidstabTrfPath(options.layerId, options.effect.id);
  const args = buildVidstabDetectArgs(options.inputPath, trfPath, options.effect);
  const result = await runFfmpegAndWait({
    ffmpegPath: options.ffmpegPath,
    args,
  });
  if (result.code !== 0) {
    const tail = result.logs.slice(-8).join(" ");
    throw new Error(tail || "VidStab analysis failed");
  }
  if (!existsSync(trfPath)) {
    throw new Error("VidStab analysis completed but transform file was not created");
  }
  return { trfPath, logs: result.logs };
}
