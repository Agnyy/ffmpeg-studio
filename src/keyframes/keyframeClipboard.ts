import type { TimelineLayer } from "../shared/project";
import type { KeyframeClipboard, SelectedKeyframeRef } from "./keyframeSelection";
import type { KeyframeInterpolation, LayerKeyframes, TransformPropertyKey } from "./keyframeTypes";
import { ensureEffectKeyframes } from "./layerEffectKeyframes";
import {
  addOrUpdateKeyframe,
  moveKeyframeTime,
  removeKeyframes,
  setKeyframesInterpolation,
} from "./keyframeUtils";

function getTransformRefs(refs: SelectedKeyframeRef[]): Array<Extract<SelectedKeyframeRef, { kind: "transform" }>> {
  return refs.filter((ref): ref is Extract<SelectedKeyframeRef, { kind: "transform" }> => ref.kind === "transform");
}

function getEffectRefs(refs: SelectedKeyframeRef[]): Array<Extract<SelectedKeyframeRef, { kind: "effect" }>> {
  return refs.filter((ref): ref is Extract<SelectedKeyframeRef, { kind: "effect" }> => ref.kind === "effect");
}

export function buildKeyframeClipboard(
  layer: TimelineLayer,
  refs: SelectedKeyframeRef[]
): KeyframeClipboard | { error: string } {
  if (refs.length === 0) {
    return { error: "No keyframes selected" };
  }

  const layerRefs = refs.filter((ref) => ref.layerId === layer.id);
  if (layerRefs.length === 0) {
    return { error: "Selected keyframes are on another layer" };
  }

  const transformRefs = getTransformRefs(layerRefs);
  const effectRefs = getEffectRefs(layerRefs);

  if (transformRefs.length > 0 && effectRefs.length > 0) {
    return { error: "Copy keyframes from one property at a time" };
  }

  if (transformRefs.length > 0) {
    const properties = new Set(transformRefs.map((ref) => ref.property));
    if (properties.size > 1) {
      return { error: "Copy keyframes from one property at a time" };
    }

    const property = transformRefs[0].property;
    const propertyData = layer.keyframes[property];
    const selectedIds = new Set(transformRefs.map((ref) => ref.keyframeId));
    const selectedKeyframes = propertyData.keyframes.filter((kf) => selectedIds.has(kf.id));

    if (selectedKeyframes.length === 0) {
      return { error: "No keyframes to copy" };
    }

    const earliest = Math.min(...selectedKeyframes.map((kf) => kf.time));

    return {
      kind: "transform",
      property,
      keyframes: selectedKeyframes.map((kf) => ({
        relativeTime: kf.time - earliest,
        value: kf.value,
        interpolation: kf.interpolation ?? "linear",
      })),
    };
  }

  const effectParams = new Set(effectRefs.map((ref) => `${ref.effectId}:${ref.param}`));
  if (effectParams.size > 1) {
    return { error: "Copy keyframes from one effect parameter at a time" };
  }

  const ref = effectRefs[0];
  const effect = layer.effects?.find((entry) => entry.id === ref.effectId);
  if (!effect) {
    return { error: "Effect not found" };
  }

  const property = ensureEffectKeyframes(effect).keyframes![ref.param];
  const selectedIds = new Set(effectRefs.map((entry) => entry.keyframeId));
  const selectedKeyframes = property.keyframes.filter((kf) => selectedIds.has(kf.id));

  if (selectedKeyframes.length === 0) {
    return { error: "No keyframes to copy" };
  }

  const earliest = Math.min(...selectedKeyframes.map((kf) => kf.time));

  return {
    kind: "effect",
    effectType: effect.type,
    param: ref.param,
    keyframes: selectedKeyframes.map((kf) => ({
      relativeTime: kf.time - earliest,
      value: kf.value,
      interpolation: kf.interpolation ?? "linear",
    })),
  };
}

export function pasteKeyframeClipboard(
  layer: TimelineLayer,
  clipboard: KeyframeClipboard,
  currentTime: number,
  targetEffectId?: string
): TimelineLayer {
  if (clipboard.kind === "transform") {
    let nextKeyframes: LayerKeyframes = { ...layer.keyframes };
    let property = { ...nextKeyframes[clipboard.property], enabled: true };

    for (const entry of clipboard.keyframes) {
      property = addOrUpdateKeyframe(
        property,
        currentTime + entry.relativeTime,
        entry.value,
        entry.interpolation
      );
    }

    nextKeyframes = { ...nextKeyframes, [clipboard.property]: property };
    return { ...layer, transformExpanded: true, keyframes: nextKeyframes };
  }

  if (!targetEffectId) {
    return layer;
  }

  const nextEffects = (layer.effects ?? []).map((effect) => {
    if (effect.id !== targetEffectId) {
      return effect;
    }
    if (effect.type !== clipboard.effectType) {
      return effect;
    }

    let next = ensureEffectKeyframes(effect);
    let property = { ...next.keyframes![clipboard.param], enabled: true };

    for (const entry of clipboard.keyframes) {
      property = addOrUpdateKeyframe(
        property,
        currentTime + entry.relativeTime,
        entry.value,
        entry.interpolation
      );
    }

    return {
      ...next,
      collapsed: false,
      keyframes: { ...next.keyframes!, [clipboard.param]: property },
    };
  });

  return { ...layer, effects: nextEffects };
}

export function deleteSelectedKeyframesFromLayers(
  layers: TimelineLayer[],
  refs: SelectedKeyframeRef[]
): TimelineLayer[] {
  if (refs.length === 0) {
    return layers;
  }

  const transformByLayer = new Map<string, Map<TransformPropertyKey, Set<string>>>();
  const effectByLayer = new Map<string, Map<string, Map<string, Set<string>>>>();

  for (const ref of refs) {
    if (ref.kind === "transform") {
      let layerMap = transformByLayer.get(ref.layerId);
      if (!layerMap) {
        layerMap = new Map();
        transformByLayer.set(ref.layerId, layerMap);
      }
      let ids = layerMap.get(ref.property);
      if (!ids) {
        ids = new Set();
        layerMap.set(ref.property, ids);
      }
      ids.add(ref.keyframeId);
      continue;
    }

    let layerMap = effectByLayer.get(ref.layerId);
    if (!layerMap) {
      layerMap = new Map();
      effectByLayer.set(ref.layerId, layerMap);
    }
    let effectMap = layerMap.get(ref.effectId);
    if (!effectMap) {
      effectMap = new Map();
      layerMap.set(ref.effectId, effectMap);
    }
    let ids = effectMap.get(ref.param);
    if (!ids) {
      ids = new Set();
      effectMap.set(ref.param, ids);
    }
    ids.add(ref.keyframeId);
  }

  return layers.map((layer) => {
    let nextLayer = { ...layer };
    const transformMap = transformByLayer.get(layer.id);
    if (transformMap) {
      let nextKeyframes = { ...layer.keyframes };
      for (const [property, ids] of transformMap) {
        nextKeyframes = {
          ...nextKeyframes,
          [property]: removeKeyframes(nextKeyframes[property], ids),
        };
      }
      nextLayer = { ...nextLayer, keyframes: nextKeyframes };
    }

    const effectMap = effectByLayer.get(layer.id);
    if (effectMap) {
      nextLayer = {
        ...nextLayer,
        effects: (layer.effects ?? []).map((effect) => {
          const paramMap = effectMap.get(effect.id);
          if (!paramMap || !effect.keyframes) {
            return effect;
          }
          let nextKeyframes = { ...effect.keyframes };
          for (const [param, ids] of paramMap) {
            if (!nextKeyframes[param]) {
              continue;
            }
            nextKeyframes = {
              ...nextKeyframes,
              [param]: removeKeyframes(nextKeyframes[param], ids),
            };
          }
          return { ...effect, keyframes: nextKeyframes };
        }),
      };
    }

    return nextLayer;
  });
}

export function setSelectedKeyframesInterpolation(
  layers: TimelineLayer[],
  refs: SelectedKeyframeRef[],
  interpolation: KeyframeInterpolation
): TimelineLayer[] {
  if (refs.length === 0) {
    return layers;
  }

  const transformByLayer = new Map<string, Map<TransformPropertyKey, Set<string>>>();
  const effectByLayer = new Map<string, Map<string, Map<string, Set<string>>>>();

  for (const ref of refs) {
    if (ref.kind === "transform") {
      let layerMap = transformByLayer.get(ref.layerId);
      if (!layerMap) {
        layerMap = new Map();
        transformByLayer.set(ref.layerId, layerMap);
      }
      let ids = layerMap.get(ref.property);
      if (!ids) {
        ids = new Set();
        layerMap.set(ref.property, ids);
      }
      ids.add(ref.keyframeId);
      continue;
    }

    let layerMap = effectByLayer.get(ref.layerId);
    if (!layerMap) {
      layerMap = new Map();
      effectByLayer.set(ref.layerId, layerMap);
    }
    let effectMap = layerMap.get(ref.effectId);
    if (!effectMap) {
      effectMap = new Map();
      layerMap.set(ref.effectId, effectMap);
    }
    let ids = effectMap.get(ref.param);
    if (!ids) {
      ids = new Set();
      effectMap.set(ref.param, ids);
    }
    ids.add(ref.keyframeId);
  }

  return layers.map((layer) => {
    let nextLayer = { ...layer };
    const transformMap = transformByLayer.get(layer.id);
    if (transformMap) {
      let nextKeyframes = { ...layer.keyframes };
      for (const [property, ids] of transformMap) {
        nextKeyframes = {
          ...nextKeyframes,
          [property]: setKeyframesInterpolation(nextKeyframes[property], ids, interpolation),
        };
      }
      nextLayer = { ...nextLayer, keyframes: nextKeyframes };
    }

    const effectMap = effectByLayer.get(layer.id);
    if (effectMap) {
      nextLayer = {
        ...nextLayer,
        effects: (layer.effects ?? []).map((effect) => {
          const paramMap = effectMap.get(effect.id);
          if (!paramMap || !effect.keyframes) {
            return effect;
          }
          let nextKeyframes = { ...effect.keyframes };
          for (const [param, ids] of paramMap) {
            if (!nextKeyframes[param]) {
              continue;
            }
            nextKeyframes = {
              ...nextKeyframes,
              [param]: setKeyframesInterpolation(nextKeyframes[param], ids, interpolation),
            };
          }
          return { ...effect, keyframes: nextKeyframes };
        }),
      };
    }

    return nextLayer;
  });
}

export function moveSelectedEffectKeyframe(
  layer: TimelineLayer,
  effectId: string,
  param: string,
  keyframeId: string,
  newTime: number
): TimelineLayer {
  return {
    ...layer,
    effects: (layer.effects ?? []).map((effect) => {
      if (effect.id !== effectId || !effect.keyframes?.[param]) {
        return effect;
      }
      return {
        ...effect,
        keyframes: {
          ...effect.keyframes,
          [param]: moveKeyframeTime(effect.keyframes[param], keyframeId, newTime),
        },
      };
    }),
  };
}
