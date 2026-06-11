import { incrementRenderCount } from "../perf/renderCounts";

export function useRenderCount(componentName: string): void {
  incrementRenderCount(componentName);
}
