import type { ProjectItem, TimelineLayer } from "./project";

export type CompRuntimeState = {
  layers: TimelineLayer[];
  currentTime: number;
  workAreaStart: number;
  workAreaEnd: number;
  selectedLayerId: string | null;
};

export function migrateCompositionName(name: string): string {
  if (name === "Main Timeline") {
    return "Comp 1";
  }
  return name;
}

export function nextCompositionName(projectItems: ProjectItem[]): string {
  const used = new Set(
    projectItems
      .filter((item) => item.type === "composition")
      .map((item) => migrateCompositionName(item.name))
  );
  let index = 1;
  while (used.has(`Comp ${index}`)) {
    index += 1;
  }
  return `Comp ${index}`;
}

export function emptyCompRuntime(duration = 10): CompRuntimeState {
  return {
    layers: [],
    currentTime: 0,
    workAreaStart: 0,
    workAreaEnd: duration,
    selectedLayerId: null,
  };
}

export function compRuntimeFromComposition(input: {
  layers: TimelineLayer[];
  currentTime: number;
  workAreaStart: number;
  workAreaEnd: number;
  selectedLayerId?: string | null;
  duration: number;
}): CompRuntimeState {
  return {
    layers: input.layers,
    currentTime: input.currentTime,
    workAreaStart: input.workAreaStart,
    workAreaEnd: input.workAreaEnd > 0 ? input.workAreaEnd : input.duration,
    selectedLayerId: input.selectedLayerId ?? null,
  };
}

export function captureActiveCompRuntime(input: {
  activeCompositionId: string | null;
  timelineLayers: TimelineLayer[];
  compCurrentTime: number;
  workAreaStart: number;
  workAreaEnd: number;
  selectedLayerId: string | null;
  compStatesById: Record<string, CompRuntimeState>;
}): Record<string, CompRuntimeState> {
  if (!input.activeCompositionId) {
    return { ...input.compStatesById };
  }
  return {
    ...input.compStatesById,
    [input.activeCompositionId]: {
      layers: input.timelineLayers,
      currentTime: input.compCurrentTime,
      workAreaStart: input.workAreaStart,
      workAreaEnd: input.workAreaEnd,
      selectedLayerId: input.selectedLayerId,
    },
  };
}
