type RenderCountListener = () => void;

const counts = new Map<string, number>();
const listeners = new Set<RenderCountListener>();

export function incrementRenderCount(componentName: string): void {
  counts.set(componentName, (counts.get(componentName) ?? 0) + 1);
  for (const listener of listeners) {
    listener();
  }
}

export function getRenderCounts(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [name, count] of counts) {
    result[name] = count;
  }
  return result;
}

export function resetRenderCounts(): void {
  counts.clear();
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeRenderCounts(listener: RenderCountListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
