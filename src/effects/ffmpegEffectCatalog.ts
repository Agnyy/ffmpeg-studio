import type { LayerEffectParamValue } from "../shared/effects";

export type EffectCapability =
  | "preview"
  | "render"
  | "render-only"
  | "analysis"
  | "build-dependent";

export type EffectParamDefinition = {
  key: string;
  label: string;
  type: "number" | "string" | "boolean" | "enum";
  min?: number;
  max?: number;
  step?: number;
  defaultValue: LayerEffectParamValue;
  enumOptions?: { value: string; label: string }[];
  renderSupported?: boolean;
  previewSupported?: boolean;
  hidden?: boolean;
};

export type FfmpegEffectDefinition = {
  id: string;
  name: string;
  category: string;
  ffmpegFilters: string[];
  capability: EffectCapability[];
  description: string;
  params: EffectParamDefinition[];
  previewSupport: "css" | "proxy" | "none";
  renderSupport: "filtergraph" | "two-pass" | "none";
  missingHint?: string;
};

export const FFMPEG_EFFECT_CATEGORIES = [
  "Color",
  "Blur & Sharpen",
  "Cleanup",
  "Geometry",
  "Stabilization",
  "Audio",
] as const;

export type FfmpegEffectCategory = (typeof FFMPEG_EFFECT_CATEGORIES)[number];

export const FFMPEG_EFFECT_CATALOG: FfmpegEffectDefinition[] = [
  // Color
  {
    id: "hue",
    name: "Hue / Saturation",
    category: "Color",
    ffmpegFilters: ["hue"],
    capability: ["preview", "render"],
    description: "Adjust hue rotation and saturation using FFmpeg hue filter.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "hue", label: "Hue", type: "number", min: -180, max: 180, step: 1, defaultValue: 0, renderSupported: true },
      { key: "saturation", label: "Saturation", type: "number", min: 0, max: 3, step: 0.05, defaultValue: 1, renderSupported: true },
    ],
  },
  {
    id: "curves",
    name: "Curves",
    category: "Color",
    ffmpegFilters: ["curves"],
    capability: ["render-only"],
    description: "Apply tonal curves (preset: lighter/darker increase/decrease).",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      {
        key: "preset",
        label: "Preset",
        type: "enum",
        defaultValue: "none",
        enumOptions: [
          { value: "none", label: "None" },
          { value: "lighter", label: "Lighter" },
          { value: "darker", label: "Darker" },
          { value: "increase_contrast", label: "Increase Contrast" },
          { value: "decrease_contrast", label: "Decrease Contrast" },
        ],
        renderSupported: true,
      },
    ],
  },
  {
    id: "levels",
    name: "Levels",
    category: "Color",
    ffmpegFilters: ["eq"],
    capability: ["render-only"],
    description: "Adjust brightness and contrast via FFmpeg eq filter.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "brightness", label: "Brightness", type: "number", min: -1, max: 1, step: 0.05, defaultValue: 0, renderSupported: true },
      { key: "contrast", label: "Contrast", type: "number", min: 0, max: 3, step: 0.05, defaultValue: 1, renderSupported: true },
    ],
  },
  {
    id: "gamma",
    name: "Gamma",
    category: "Color",
    ffmpegFilters: ["eq"],
    capability: ["render-only"],
    description: "Adjust gamma via FFmpeg eq filter.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "gamma", label: "Gamma", type: "number", min: 0.1, max: 3, step: 0.05, defaultValue: 1, renderSupported: true },
    ],
  },
  // Blur & Sharpen
  {
    id: "gblur",
    name: "Gaussian Blur",
    category: "Blur & Sharpen",
    ffmpegFilters: ["gblur"],
    capability: ["preview", "render"],
    description: "Gaussian blur using gblur filter.",
    previewSupport: "css",
    renderSupport: "filtergraph",
    params: [
      { key: "sigma", label: "Sigma", type: "number", min: 0, max: 20, step: 0.5, defaultValue: 2, renderSupported: true, previewSupported: true },
    ],
  },
  {
    id: "boxblur",
    name: "Box Blur",
    category: "Blur & Sharpen",
    ffmpegFilters: ["boxblur"],
    capability: ["preview", "render"],
    description: "Box blur filter.",
    previewSupport: "css",
    renderSupport: "filtergraph",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0, max: 20, step: 0.5, defaultValue: 2, renderSupported: true, previewSupported: true },
    ],
  },
  {
    id: "unsharp",
    name: "Unsharp Mask",
    category: "Blur & Sharpen",
    ffmpegFilters: ["unsharp"],
    capability: ["render-only"],
    description: "Sharpen using unsharp mask. Render-only in live preview.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "amount", label: "Amount", type: "number", min: 0, max: 3, step: 0.05, defaultValue: 1, renderSupported: true },
    ],
  },
  // Cleanup
  {
    id: "hqdn3d",
    name: "Denoise",
    category: "Cleanup",
    ffmpegFilters: ["hqdn3d"],
    capability: ["render-only"],
    description: "High-quality 3D denoise filter.",
    missingHint: "This filter was not found in ffmpeg -filters.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "strength", label: "Strength", type: "number", min: 0, max: 10, step: 0.5, defaultValue: 4, renderSupported: true },
    ],
  },
  {
    id: "nlmeans",
    name: "Strong Denoise",
    category: "Cleanup",
    ffmpegFilters: ["nlmeans"],
    capability: ["render-only", "build-dependent"],
    description: "Non-local means denoise. May be missing in some FFmpeg builds.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    missingHint: "This filter was not found in ffmpeg -filters.",
    params: [
      { key: "strength", label: "Strength", type: "number", min: 1, max: 30, step: 1, defaultValue: 10, renderSupported: true },
    ],
  },
  {
    id: "deflicker",
    name: "Deflicker",
    category: "Cleanup",
    ffmpegFilters: ["deflicker"],
    capability: ["render-only"],
    description: "Reduce temporal brightness flicker.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "size", label: "Size", type: "number", min: 5, max: 129, step: 2, defaultValue: 15, renderSupported: true },
    ],
  },
  {
    id: "deband",
    name: "Deband",
    category: "Cleanup",
    ffmpegFilters: ["deband"],
    capability: ["render-only"],
    description: "Reduce banding artifacts.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "threshold", label: "Threshold", type: "number", min: 0, max: 1, step: 0.01, defaultValue: 0.02, renderSupported: true },
    ],
  },
  // Geometry
  {
    id: "lenscorrection",
    name: "Lens Correction",
    category: "Geometry",
    ffmpegFilters: ["lenscorrection"],
    capability: ["render-only"],
    description: "Correct lens distortion.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "k1", label: "K1", type: "number", min: -1, max: 1, step: 0.01, defaultValue: 0, renderSupported: true },
      { key: "k2", label: "K2", type: "number", min: -1, max: 1, step: 0.01, defaultValue: 0, renderSupported: true },
    ],
  },
  {
    id: "hflip",
    name: "Flip Horizontal",
    category: "Geometry",
    ffmpegFilters: ["hflip"],
    capability: ["preview", "render"],
    description: "Mirror video horizontally.",
    previewSupport: "css",
    renderSupport: "filtergraph",
    params: [],
  },
  {
    id: "vflip",
    name: "Flip Vertical",
    category: "Geometry",
    ffmpegFilters: ["vflip"],
    capability: ["preview", "render"],
    description: "Mirror video vertically.",
    previewSupport: "css",
    renderSupport: "filtergraph",
    params: [],
  },
  {
    id: "transpose",
    name: "Rotate 90°",
    category: "Geometry",
    ffmpegFilters: ["transpose"],
    capability: ["render-only"],
    description: "Rotate video 90° clockwise (transpose=1).",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      {
        key: "direction",
        label: "Direction",
        type: "enum",
        defaultValue: "clockwise",
        enumOptions: [
          { value: "clockwise", label: "90° CW" },
          { value: "counterclockwise", label: "90° CCW" },
        ],
        renderSupported: true,
      },
    ],
  },
  {
    id: "pad",
    name: "Pad / Letterbox",
    category: "Geometry",
    ffmpegFilters: ["pad"],
    capability: ["render-only"],
    description: "Pad video to target dimensions with letterboxing.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "width", label: "Width", type: "number", min: 16, max: 7680, step: 1, defaultValue: 1920, renderSupported: true },
      { key: "height", label: "Height", type: "number", min: 16, max: 4320, step: 1, defaultValue: 1080, renderSupported: true },
    ],
  },
  // Stabilization
  {
    id: "deshake",
    name: "Simple Stabilization / Deshake",
    category: "Stabilization",
    ffmpegFilters: ["deshake"],
    capability: ["render-only"],
    description: "Fast camera shake reduction using FFmpeg deshake filter.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      {
        key: "strength",
        label: "Strength",
        type: "enum",
        defaultValue: "medium",
        enumOptions: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ],
        renderSupported: true,
      },
      {
        key: "edge",
        label: "Edge",
        type: "enum",
        defaultValue: "black",
        enumOptions: [
          { value: "black", label: "Black" },
          { value: "original", label: "Original" },
          { value: "clamp", label: "Clamp" },
          { value: "mirror", label: "Mirror" },
        ],
        renderSupported: true,
      },
    ],
  },
  {
    id: "vidstab",
    name: "Advanced Stabilization / VidStab",
    category: "Stabilization",
    ffmpegFilters: ["vidstabdetect", "vidstabtransform"],
    capability: ["analysis", "render", "build-dependent"],
    description: "Two-pass motion stabilization using vidstabdetect + vidstabtransform.",
    previewSupport: "none",
    renderSupport: "two-pass",
    missingHint: "Requires FFmpeg built with libvidstab",
    params: [
      { key: "analysisStatus", label: "Status", type: "string", defaultValue: "none", hidden: true },
      { key: "analysisPath", label: "Analysis Path", type: "string", defaultValue: "", hidden: true },
      { key: "shakiness", label: "Shakiness", type: "number", min: 1, max: 10, step: 1, defaultValue: 5, renderSupported: true },
      { key: "accuracy", label: "Accuracy", type: "number", min: 1, max: 15, step: 1, defaultValue: 15, renderSupported: true },
      { key: "smoothing", label: "Smoothing", type: "number", min: 0, max: 30, step: 1, defaultValue: 10, renderSupported: true },
      {
        key: "zoom",
        label: "Zoom",
        type: "enum",
        defaultValue: "auto",
        enumOptions: [
          { value: "auto", label: "Auto" },
          { value: "manual", label: "Manual" },
        ],
        renderSupported: true,
      },
      { key: "zoomAmount", label: "Zoom Amount", type: "number", min: 0, max: 20, step: 0.5, defaultValue: 0, renderSupported: true },
      {
        key: "cropBorders",
        label: "Crop Borders",
        type: "enum",
        defaultValue: "keep",
        enumOptions: [
          { value: "keep", label: "Keep" },
          { value: "black", label: "Black" },
        ],
        renderSupported: true,
      },
      { key: "sharpen", label: "Post Sharpen", type: "boolean", defaultValue: true, renderSupported: true },
    ],
  },
  // Audio
  {
    id: "loudnorm",
    name: "Loudness Normalize",
    category: "Audio",
    ffmpegFilters: ["loudnorm"],
    capability: ["render-only", "analysis"],
    description: "EBU R128 loudness normalization. Render-only; may require two-pass for best results.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "integrated", label: "Target LUFS", type: "number", min: -30, max: -5, step: 0.5, defaultValue: -16, renderSupported: true },
    ],
  },
  {
    id: "acompressor",
    name: "Compressor",
    category: "Audio",
    ffmpegFilters: ["acompressor"],
    capability: ["render-only"],
    description: "Dynamic range compression.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "threshold", label: "Threshold dB", type: "number", min: -60, max: 0, step: 1, defaultValue: -20, renderSupported: true },
      { key: "ratio", label: "Ratio", type: "number", min: 1, max: 20, step: 0.5, defaultValue: 4, renderSupported: true },
    ],
  },
  {
    id: "equalizer",
    name: "Equalizer",
    category: "Audio",
    ffmpegFilters: ["equalizer"],
    capability: ["render-only"],
    description: "Parametric equalizer band.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "frequency", label: "Frequency Hz", type: "number", min: 20, max: 20000, step: 10, defaultValue: 1000, renderSupported: true },
      { key: "gain", label: "Gain dB", type: "number", min: -20, max: 20, step: 0.5, defaultValue: 0, renderSupported: true },
    ],
  },
  {
    id: "highpass",
    name: "Highpass",
    category: "Audio",
    ffmpegFilters: ["highpass"],
    capability: ["render-only"],
    description: "High-pass audio filter.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "frequency", label: "Frequency Hz", type: "number", min: 20, max: 20000, step: 10, defaultValue: 200, renderSupported: true },
    ],
  },
  {
    id: "lowpass",
    name: "Lowpass",
    category: "Audio",
    ffmpegFilters: ["lowpass"],
    capability: ["render-only"],
    description: "Low-pass audio filter.",
    previewSupport: "none",
    renderSupport: "filtergraph",
    params: [
      { key: "frequency", label: "Frequency Hz", type: "number", min: 20, max: 20000, step: 10, defaultValue: 3000, renderSupported: true },
    ],
  },
];

export type CatalogEffectId = (typeof FFMPEG_EFFECT_CATALOG)[number]["id"];

export function getCatalogEffectById(id: string): FfmpegEffectDefinition | undefined {
  return FFMPEG_EFFECT_CATALOG.find((entry) => entry.id === id);
}

export function isCatalogEffectId(id: string): id is CatalogEffectId {
  return FFMPEG_EFFECT_CATALOG.some((entry) => entry.id === id);
}

export function getCatalogEffectsByCategory(
  category: FfmpegEffectCategory
): FfmpegEffectDefinition[] {
  return FFMPEG_EFFECT_CATALOG.filter((entry) => entry.category === category);
}

export type EffectBadgeKind = "preview" | "render-only" | "analyze" | "missing";

export function getEffectBadges(
  def: FfmpegEffectDefinition,
  filtersAvailable: boolean
): EffectBadgeKind[] {
  const badges: EffectBadgeKind[] = [];
  if (!filtersAvailable) {
    badges.push("missing");
    return badges;
  }
  if (def.capability.includes("analysis")) {
    badges.push("analyze");
  }
  if (def.previewSupport !== "none") {
    badges.push("preview");
  } else if (def.renderSupport !== "none") {
    badges.push("render-only");
  }
  return badges;
}

export function getEffectUnavailableTooltip(def: FfmpegEffectDefinition): string {
  if (def.missingHint) {
    return def.missingHint;
  }
  return "This FFmpeg filter is not available in your current FFmpeg build.";
}
