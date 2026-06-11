import { configureNodeAvFfmpegLogging } from "../shared/ffmpegLogFilter";

type NodeAvApiModule = typeof import("node-av/api");
type NodeAvLibModule = typeof import("node-av/lib");

const dynamicImport = new Function(
  "specifier",
  "return import(specifier)"
) as <T = unknown>(specifier: string) => Promise<T>;

let nodeAvApiModule: NodeAvApiModule | null = null;
let nodeAvLibModule: NodeAvLibModule | null = null;
let loadError: string | null = null;

function captureLoadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  loadError = message;
  return message;
}

export function getNodeAvLoadError(): string | null {
  return loadError;
}

export async function loadNodeAvApi(): Promise<NodeAvApiModule> {
  if (nodeAvApiModule) {
    return nodeAvApiModule;
  }
  if (loadError) {
    throw new Error(loadError);
  }
  try {
    await configureNodeAvFfmpegLogging();
    nodeAvApiModule = await dynamicImport<NodeAvApiModule>("node-av/api");
    return nodeAvApiModule;
  } catch (error) {
    throw new Error(captureLoadError(error));
  }
}

export async function loadNodeAvLib(): Promise<NodeAvLibModule> {
  if (nodeAvLibModule) {
    return nodeAvLibModule;
  }
  if (loadError) {
    throw new Error(loadError);
  }
  try {
    nodeAvLibModule = await dynamicImport<NodeAvLibModule>("node-av/lib");
    return nodeAvLibModule;
  } catch (error) {
    throw new Error(captureLoadError(error));
  }
}
