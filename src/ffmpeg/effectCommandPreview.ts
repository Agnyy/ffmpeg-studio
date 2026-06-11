import type { LayerEffect } from "../shared/effects";
import { buildVidstabDetectArgs } from "./catalogEffectFilters";
import { buildCatalogVideoEffectFilter } from "./catalogEffectFilters";
import { formatCommandPreview } from "./ffmpegRunner";

export async function buildVidstabTwoPassPreview(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  effect: LayerEffect
): Promise<string> {
  const pass1Args = buildVidstabDetectArgs(
    inputPath,
    String(effect.params.analysisPath ?? "analysis.trf"),
    effect
  );
  const pass2Filter = buildCatalogVideoEffectFilter(effect);
  const pass2Args = pass2Filter
    ? ["-hide_banner", "-y", "-i", inputPath, "-vf", pass2Filter, outputPath]
    : [];

  const pass1 = await formatCommandPreview(ffmpegPath, pass1Args);
  const pass2 =
    pass2Args.length > 0
      ? await formatCommandPreview(ffmpegPath, pass2Args)
      : "(Pass 2 unavailable — analysis not ready)";

  return `Pass 1:\n${pass1}\n\nPass 2:\n${pass2}`;
}

export function layerHasVidstabEffect(layers: { effects?: LayerEffect[] }[]): LayerEffect | null {
  for (const layer of layers) {
    for (const effect of layer.effects ?? []) {
      if (effect.enabled && effect.type === "vidstab") {
        return effect;
      }
    }
  }
  return null;
}
