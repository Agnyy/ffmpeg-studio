import type { LayerEffectType } from "../shared/effects";
import { getCatalogEffectById, isCatalogEffectId } from "../effects/ffmpegEffectCatalog";
import type { AnimatedProperty } from "./keyframeTypes";
import { sanitizeKeyframeProperty } from "./keyframeUtils";

export type EffectParamKeyframes = Record<string, AnimatedProperty<number>>;

export type EffectKeyframeParamDefinition = {
  effectType: LayerEffectType;
  param: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  renderSupported: boolean;
  previewSupported: boolean;
};

export const EFFECT_KEYFRAME_PARAMS: EffectKeyframeParamDefinition[] = [
  {
    effectType: "brightnessContrast",
    param: "brightness",
    label: "Brightness",
    min: -1,
    max: 1,
    defaultValue: 0,
    renderSupported: true,
    previewSupported: true,
  },
  {
    effectType: "brightnessContrast",
    param: "contrast",
    label: "Contrast",
    min: 0,
    max: 3,
    defaultValue: 1,
    renderSupported: true,
    previewSupported: true,
  },
  {
    effectType: "saturation",
    param: "saturation",
    label: "Saturation",
    min: 0,
    max: 3,
    defaultValue: 1,
    renderSupported: true,
    previewSupported: true,
  },
  {
    effectType: "blur",
    param: "radius",
    label: "Radius",
    min: 0,
    max: 20,
    defaultValue: 2,
    renderSupported: true,
    previewSupported: true,
  },
  {
    effectType: "sharpen",
    param: "amount",
    label: "Amount",
    min: 0,
    max: 3,
    defaultValue: 0,
    renderSupported: false,
    previewSupported: false,
  },
  {
    effectType: "audioVolume",
    param: "volume",
    label: "Volume",
    min: 0,
    max: 2,
    defaultValue: 1,
    renderSupported: true,
    previewSupported: false,
  },
  {
    effectType: "speed",
    param: "speed",
    label: "Speed",
    min: 0.5,
    max: 2,
    defaultValue: 1,
    renderSupported: false,
    previewSupported: false,
  },
];

function catalogParamDefinitions(effectType: LayerEffectType): EffectKeyframeParamDefinition[] {
  if (!isCatalogEffectId(effectType)) {
    return [];
  }
  const catalog = getCatalogEffectById(effectType);
  if (!catalog) {
    return [];
  }
  return catalog.params
    .filter((param) => param.type === "number" && !param.hidden)
    .map((param) => ({
      effectType,
      param: param.key,
      label: param.label,
      min: param.min ?? 0,
      max: param.max ?? 100,
      defaultValue: typeof param.defaultValue === "number" ? param.defaultValue : 0,
      renderSupported: param.renderSupported ?? true,
      previewSupported: param.previewSupported ?? false,
    }));
}

export function getEffectParamDefinitions(
  effectType: LayerEffectType
): EffectKeyframeParamDefinition[] {
  const legacy = EFFECT_KEYFRAME_PARAMS.filter((def) => def.effectType === effectType);
  if (legacy.length > 0) {
    return legacy;
  }
  return catalogParamDefinitions(effectType);
}

export function getEffectParamDefinition(
  effectType: LayerEffectType,
  param: string
): EffectKeyframeParamDefinition | undefined {
  return EFFECT_KEYFRAME_PARAMS.find(
    (def) => def.effectType === effectType && def.param === param
  );
}

export function isEffectParamAnimatable(effectType: LayerEffectType, param: string): boolean {
  return Boolean(getEffectParamDefinition(effectType, param));
}

export function createDefaultEffectParamKeyframes(
  effectType: LayerEffectType
): EffectParamKeyframes {
  const result: EffectParamKeyframes = {};
  for (const def of getEffectParamDefinitions(effectType)) {
    result[def.param] = { enabled: false, keyframes: [] };
  }
  return result;
}

export function sanitizeEffectParamKeyframes(
  effectType: LayerEffectType,
  keyframes: EffectParamKeyframes | undefined
): EffectParamKeyframes {
  const defaults = createDefaultEffectParamKeyframes(effectType);
  if (!keyframes) {
    return defaults;
  }
  const next: EffectParamKeyframes = { ...defaults };
  for (const def of getEffectParamDefinitions(effectType)) {
    next[def.param] = sanitizeKeyframeProperty(
      keyframes[def.param] ?? defaults[def.param]
    );
  }
  return next;
}
