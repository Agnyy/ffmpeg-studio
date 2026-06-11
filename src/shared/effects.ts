import type { EffectParamKeyframes } from "../keyframes/effectKeyframes";
import { createDefaultEffectParamKeyframes } from "../keyframes/effectKeyframes";
import {
  FFMPEG_EFFECT_CATALOG,
  getCatalogEffectById,
  isCatalogEffectId,
  type CatalogEffectId,
} from "../effects/ffmpegEffectCatalog";

export type LegacyLayerEffectType =
  | "brightnessContrast"
  | "saturation"
  | "blur"
  | "sharpen"
  | "grayscale"
  | "audioVolume"
  | "speed";

export type LayerEffectType = LegacyLayerEffectType | CatalogEffectId;

export type LayerEffectParamValue = number | string | boolean;

export type LayerEffect = {
  id: string;
  type: LayerEffectType;
  name: string;
  enabled: boolean;
  collapsed: boolean;
  params: Record<string, LayerEffectParamValue>;
  keyframes?: EffectParamKeyframes;
};

export type EffectMenuGroup = {
  label: string;
  items: { type: LayerEffectType; label: string }[];
};

export const EFFECT_MENU_GROUPS: EffectMenuGroup[] = [
  {
    label: "Color",
    items: [
      { type: "brightnessContrast", label: "Brightness / Contrast" },
      { type: "saturation", label: "Saturation" },
      { type: "grayscale", label: "Grayscale" },
    ],
  },
  {
    label: "Blur & Sharpen",
    items: [
      { type: "blur", label: "Blur" },
      { type: "sharpen", label: "Sharpen" },
    ],
  },
  {
    label: "Audio",
    items: [{ type: "audioVolume", label: "Volume" }],
  },
  {
    label: "Time",
    items: [{ type: "speed", label: "Speed" }],
  },
];

const LEGACY_EFFECT_DEFAULTS: Record<
  LegacyLayerEffectType,
  { name: string; params: Record<string, LayerEffectParamValue> }
> = {
  brightnessContrast: {
    name: "Brightness / Contrast",
    params: { brightness: 0, contrast: 1 },
  },
  saturation: {
    name: "Saturation",
    params: { saturation: 1 },
  },
  grayscale: {
    name: "Grayscale",
    params: {},
  },
  blur: {
    name: "Blur",
    params: { radius: 2 },
  },
  sharpen: {
    name: "Sharpen",
    params: { amount: 1 },
  },
  audioVolume: {
    name: "Audio Volume",
    params: { volume: 1 },
  },
  speed: {
    name: "Speed",
    params: { speed: 1 },
  },
};

function createEffectId(): string {
  return `effect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function catalogDefaultParams(
  catalogId: CatalogEffectId
): Record<string, LayerEffectParamValue> {
  const def = getCatalogEffectById(catalogId);
  if (!def) {
    return {};
  }
  const params: Record<string, LayerEffectParamValue> = {};
  for (const param of def.params) {
    params[param.key] = param.defaultValue;
  }
  return params;
}

export function createLayerEffect(type: LayerEffectType): LayerEffect {
  if (isCatalogEffectId(type)) {
    const def = getCatalogEffectById(type);
    if (!def) {
      throw new Error(`Unknown catalog effect: ${type}`);
    }
    return {
      id: createEffectId(),
      type,
      name: def.name,
      enabled: true,
      collapsed: false,
      params: catalogDefaultParams(type),
      keyframes: createDefaultEffectParamKeyframes(type),
    };
  }

  const legacyType = type as LegacyLayerEffectType;
  const legacy = LEGACY_EFFECT_DEFAULTS[legacyType];
  return {
    id: createEffectId(),
    type: legacyType,
    name: legacy.name,
    enabled: true,
    collapsed: false,
    params: { ...legacy.params },
    keyframes: createDefaultEffectParamKeyframes(type),
  };
}

export function isVideoEffect(type: LayerEffectType): boolean {
  if (isCatalogEffectId(type)) {
    const def = getCatalogEffectById(type);
    return def?.category !== "Audio";
  }
  return type !== "audioVolume";
}

export function isAudioEffect(type: LayerEffectType): boolean {
  if (isCatalogEffectId(type)) {
    const def = getCatalogEffectById(type);
    return def?.category === "Audio";
  }
  return type === "audioVolume" || type === "speed";
}

export function isEffectPreviewable(type: LayerEffectType): boolean {
  if (isCatalogEffectId(type)) {
    const def = getCatalogEffectById(type);
    return def?.previewSupport === "css";
  }
  return (
    type === "brightnessContrast" ||
    type === "saturation" ||
    type === "grayscale" ||
    type === "blur"
  );
}

export function isEffectRenderOnly(type: LayerEffectType): boolean {
  if (isCatalogEffectId(type)) {
    const def = getCatalogEffectById(type);
    return def?.previewSupport === "none" && def.renderSupport !== "none";
  }
  return type === "sharpen" || type === "audioVolume" || type === "speed";
}

export { FFMPEG_EFFECT_CATALOG, isCatalogEffectId };
