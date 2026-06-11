import { createProjectId } from "../shared/project";
import { applyEasing } from "./keyframeInterpolation";
import type { AnimatedProperty, Keyframe, KeyframeInterpolation } from "./keyframeTypes";

const TIME_EPSILON = 0.0005;

export function sortKeyframes<T>(keyframes: Keyframe<T>[]): Keyframe<T>[] {
  return [...keyframes].sort((a, b) => a.time - b.time);
}

export function getAnimatedValue<T extends number>(
  property: AnimatedProperty<T>,
  fallbackValue: T,
  time: number
): T {
  if (!property.enabled || property.keyframes.length === 0) {
    return fallbackValue;
  }

  const sorted = sortKeyframes(property.keyframes);

  if (time <= sorted[0].time) {
    return sorted[0].value;
  }

  const last = sorted[sorted.length - 1];
  if (time >= last.time) {
    return last.value;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (time >= current.time && time < next.time) {
      if (current.interpolation === "hold") {
        return current.value;
      }
      const span = next.time - current.time;
      if (span <= 0) {
        return current.value;
      }
      const t = (time - current.time) / span;
      const eased = applyEasing(t, current.interpolation);
      return (current.value + (next.value - current.value) * eased) as T;
    }
    if (Math.abs(time - next.time) < TIME_EPSILON) {
      return next.value;
    }
  }

  return last.value;
}

export function findKeyframeAtTime<T>(
  property: AnimatedProperty<T>,
  time: number,
  tolerance = 0.05
): Keyframe<T> | null {
  return (
    property.keyframes.find((kf) => Math.abs(kf.time - time) <= tolerance) ?? null
  );
}

export function addOrUpdateKeyframe<T extends number>(
  property: AnimatedProperty<T>,
  time: number,
  value: T,
  interpolation: KeyframeInterpolation = "linear"
): AnimatedProperty<T> {
  const existing = findKeyframeAtTime(property, time);
  if (existing) {
    return {
      ...property,
      keyframes: property.keyframes.map((kf) =>
        kf.id === existing.id ? { ...kf, value, interpolation } : kf
      ),
    };
  }

  return {
    ...property,
    keyframes: sortKeyframes([
      ...property.keyframes,
      {
        id: createProjectId("kf"),
        time,
        value,
        interpolation,
      },
    ]),
  };
}

export function removeKeyframe<T>(
  property: AnimatedProperty<T>,
  keyframeId: string
): AnimatedProperty<T> {
  return {
    ...property,
    keyframes: property.keyframes.filter((kf) => kf.id !== keyframeId),
  };
}

export function removeKeyframeAtTime<T>(
  property: AnimatedProperty<T>,
  time: number,
  tolerance = 0.05
): AnimatedProperty<T> {
  const existing = findKeyframeAtTime(property, time, tolerance);
  if (!existing) {
    return property;
  }
  return removeKeyframe(property, existing.id);
}

export function toggleAnimation<T extends number>(
  property: AnimatedProperty<T>,
  currentTime: number,
  currentValue: T
): AnimatedProperty<T> {
  if (property.enabled) {
    return { enabled: false, keyframes: property.keyframes };
  }
  return addOrUpdateKeyframe(
    { enabled: true, keyframes: property.keyframes },
    currentTime,
    currentValue
  );
}

export function moveKeyframeTime<T>(
  property: AnimatedProperty<T>,
  keyframeId: string,
  newTime: number
): AnimatedProperty<T> {
  const updated = property.keyframes.map((kf) =>
    kf.id === keyframeId ? { ...kf, time: Math.max(0, newTime) } : kf
  );
  return {
    ...property,
    keyframes: sortKeyframes(updated),
  };
}

export function cloneKeyframesProperty<T>(
  property: AnimatedProperty<T>
): AnimatedProperty<T> {
  return {
    enabled: property.enabled,
    keyframes: property.keyframes.map((kf) => ({
      ...kf,
      id: createProjectId("kf"),
    })),
  };
}

export function setKeyframesInterpolation<T>(
  property: AnimatedProperty<T>,
  keyframeIds: Set<string>,
  interpolation: KeyframeInterpolation
): AnimatedProperty<T> {
  if (keyframeIds.size === 0) {
    return property;
  }
  return {
    ...property,
    keyframes: property.keyframes.map((kf) =>
      keyframeIds.has(kf.id) ? { ...kf, interpolation } : kf
    ),
  };
}

export function removeKeyframes<T>(
  property: AnimatedProperty<T>,
  keyframeIds: Set<string>
): AnimatedProperty<T> {
  if (keyframeIds.size === 0) {
    return property;
  }
  return {
    ...property,
    keyframes: property.keyframes.filter((kf) => !keyframeIds.has(kf.id)),
  };
}

export function sanitizeKeyframeProperty<T>(
  property: AnimatedProperty<T>
): AnimatedProperty<T> {
  return {
    ...property,
    keyframes: property.keyframes.map((kf) => ({
      ...kf,
      interpolation: kf.interpolation ?? "linear",
    })),
  };
}
