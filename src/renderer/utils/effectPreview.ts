import type { LayerEffect } from "../../shared/effects";
import { isEffectPreviewable } from "../../shared/effects";
import { getEffectiveEffectParam } from "../../keyframes/layerEffectKeyframes";

export function buildCssFilterFromEffects(
  effects: LayerEffect[],
  compTime = 0
): string | undefined {
  const parts: string[] = [];

  for (const effect of effects) {
    if (!effect.enabled || !isEffectPreviewable(effect.type)) {
      continue;
    }

    switch (effect.type) {
      case "brightnessContrast": {
        const brightness = getEffectiveEffectParam(effect, "brightness", compTime);
        const contrast = getEffectiveEffectParam(effect, "contrast", compTime);
        parts.push(`brightness(${Math.max(0, 1 + brightness).toFixed(3)})`);
        parts.push(`contrast(${Math.max(0, contrast).toFixed(3)})`);
        break;
      }
      case "saturation": {
        const saturation = getEffectiveEffectParam(effect, "saturation", compTime);
        parts.push(`saturate(${Math.max(0, saturation).toFixed(3)})`);
        break;
      }
      case "grayscale":
        parts.push("grayscale(1)");
        break;
      case "blur":
      case "boxblur": {
        const radius = Math.max(
          0,
          Math.min(20, getEffectiveEffectParam(effect, "radius", compTime))
        );
        parts.push(`blur(${radius.toFixed(1)}px)`);
        break;
      }
      case "gblur": {
        const sigma = Math.max(
          0,
          Math.min(20, getEffectiveEffectParam(effect, "sigma", compTime))
        );
        parts.push(`blur(${sigma.toFixed(1)}px)`);
        break;
      }
      case "hflip":
        parts.push("scaleX(-1)");
        break;
      case "vflip":
        parts.push("scaleY(-1)");
        break;
      default:
        break;
    }
  }

  return parts.length > 0 ? parts.join(" ") : undefined;
}
