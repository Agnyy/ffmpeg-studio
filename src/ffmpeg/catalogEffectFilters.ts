import type { LayerEffect } from "../shared/effects";
import { getCatalogEffectById } from "../effects/ffmpegEffectCatalog";

function num(effect: LayerEffect, key: string, fallback: number): number {
  const value = effect.params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(effect: LayerEffect, key: string, fallback: string): string {
  const value = effect.params[key];
  return typeof value === "string" ? value : fallback;
}

function bool(effect: LayerEffect, key: string, fallback: boolean): boolean {
  const value = effect.params[key];
  return typeof value === "boolean" ? value : fallback;
}

function escapePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export function buildCatalogVideoEffectFilter(effect: LayerEffect): string | null {
  switch (effect.type) {
    case "hue": {
      const h = num(effect, "hue", 0);
      const s = num(effect, "saturation", 1);
      return `hue=h=${h}:s=${s}`;
    }
    case "curves": {
      const preset = str(effect, "preset", "none");
      return preset === "none" ? null : `curves=preset=${preset}`;
    }
    case "levels": {
      const brightness = num(effect, "brightness", 0);
      const contrast = num(effect, "contrast", 1);
      return `eq=brightness=${brightness}:contrast=${contrast}`;
    }
    case "gamma": {
      const gamma = num(effect, "gamma", 1);
      return `eq=gamma=${gamma}`;
    }
    case "gblur": {
      const sigma = Math.max(0, num(effect, "sigma", 2));
      return `gblur=sigma=${sigma}`;
    }
    case "boxblur": {
      const radius = Math.max(0, Math.min(20, num(effect, "radius", 2)));
      const r = radius.toFixed(2);
      return `boxblur=${r}:${r}`;
    }
    case "unsharp": {
      const amount = Math.max(0, Math.min(3, num(effect, "amount", 1)));
      return `unsharp=5:5:${amount.toFixed(4)}:5:5:0`;
    }
    case "hqdn3d": {
      const strength = num(effect, "strength", 4);
      const s = strength.toFixed(2);
      return `hqdn3d=${s}:${s}:${s}`;
    }
    case "nlmeans": {
      const strength = num(effect, "strength", 10);
      return `nlmeans=s=${strength}`;
    }
    case "deflicker": {
      const size = Math.round(num(effect, "size", 15));
      return `deflicker=size=${size}`;
    }
    case "deband": {
      const threshold = num(effect, "threshold", 0.02);
      return `deband=1thr=${threshold}`;
    }
    case "lenscorrection": {
      const k1 = num(effect, "k1", 0);
      const k2 = num(effect, "k2", 0);
      return `lenscorrection=k1=${k1}:k2=${k2}`;
    }
    case "hflip":
      return "hflip";
    case "vflip":
      return "vflip";
    case "transpose": {
      const direction = str(effect, "direction", "clockwise");
      const transpose = direction === "counterclockwise" ? 2 : 1;
      return `transpose=${transpose}`;
    }
    case "pad": {
      const width = Math.round(num(effect, "width", 1920));
      const height = Math.round(num(effect, "height", 1080));
      return `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
    }
    case "deshake": {
      const strength = str(effect, "strength", "medium");
      const rxry = strength === "low" ? 8 : strength === "high" ? 32 : 16;
      const edge = str(effect, "edge", "black");
      return `deshake=rx=${rxry}:ry=${rxry}:edge=${edge}`;
    }
    case "vidstab": {
      const status = str(effect, "analysisStatus", "none");
      const analysisPath = str(effect, "analysisPath", "");
      if (status !== "ready" || !analysisPath) {
        return null;
      }
      const smoothing = Math.round(num(effect, "smoothing", 10));
      const cropBorders = str(effect, "cropBorders", "keep");
      const zoomMode = str(effect, "zoom", "auto");
      const zoomAmount = num(effect, "zoomAmount", 0);
      const parts = [
        `vidstabtransform=input='${escapePath(analysisPath)}':smoothing=${smoothing}:crop=${cropBorders === "black" ? "black" : "keep"}`,
      ];
      if (zoomMode === "manual" && zoomAmount > 0) {
        parts[0] += `:zoom=${zoomAmount}`;
      } else if (zoomMode === "auto") {
        parts[0] += ":optzoom=1";
      }
      if (bool(effect, "sharpen", true)) {
        parts.push("unsharp=5:5:0.8:3:3:0.4");
      }
      return parts.join(",");
    }
    default:
      return getCatalogEffectById(effect.type) ? null : null;
  }
}

export function buildCatalogAudioEffectFilter(effect: LayerEffect): string | null {
  switch (effect.type) {
    case "loudnorm": {
      const integrated = num(effect, "integrated", -16);
      return `loudnorm=I=${integrated}:TP=-1.5:LRA=11`;
    }
    case "acompressor": {
      const threshold = num(effect, "threshold", -20);
      const ratio = num(effect, "ratio", 4);
      return `acompressor=threshold=${threshold}dB:ratio=${ratio}`;
    }
    case "equalizer": {
      const frequency = Math.round(num(effect, "frequency", 1000));
      const gain = num(effect, "gain", 0);
      return `equalizer=f=${frequency}:width_type=o:width=1:g=${gain}`;
    }
    case "highpass": {
      const frequency = Math.round(num(effect, "frequency", 200));
      return `highpass=f=${frequency}`;
    }
    case "lowpass": {
      const frequency = Math.round(num(effect, "frequency", 3000));
      return `lowpass=f=${frequency}`;
    }
    default:
      return null;
  }
}

export function getCatalogEffectRenderWarnings(effect: LayerEffect): string[] {
  const warnings: string[] = [];
  const def = getCatalogEffectById(effect.type);
  if (!def || !effect.enabled) {
    return warnings;
  }

  if (def.previewSupport === "none" && def.renderSupport !== "none") {
    warnings.push(
      `${def.name}: This effect is render-only and may not be visible in live preview.`
    );
  }

  if (effect.type === "vidstab") {
    const status = str(effect, "analysisStatus", "none");
    if (status === "missing") {
      warnings.push(
        `${def.name}: Analysis file missing. Run Analyze Motion before render.`
      );
    } else if (status !== "ready") {
      warnings.push(
        `${def.name}: Motion analysis required. Run Analyze Motion before render.`
      );
    }
  }

  return warnings;
}

export function buildVidstabDetectArgs(
  inputPath: string,
  trfPath: string,
  effect: LayerEffect
): string[] {
  const shakiness = Math.round(num(effect, "shakiness", 5));
  const accuracy = Math.round(num(effect, "accuracy", 15));
  const escaped = escapePath(trfPath);
  return [
    "-hide_banner",
    "-y",
    "-i",
    inputPath,
    "-vf",
    `vidstabdetect=shakiness=${shakiness}:accuracy=${accuracy}:result='${escaped}'`,
    "-f",
    "null",
    "-",
  ];
}

export function buildVidstabTransformPreviewArgs(
  inputPath: string,
  outputPath: string,
  effect: LayerEffect
): string[] {
  const filter = buildCatalogVideoEffectFilter(effect);
  if (!filter) {
    return [];
  }
  return ["-hide_banner", "-y", "-i", inputPath, "-vf", filter, "-c:v", "libx264", "-preset", "fast", outputPath];
}
