import { configureNodeAvFfmpegLogging } from "../shared/ffmpegLogFilter";

type NodeAvApiModule = typeof import("node-av/api");

const dynamicImport = new Function(
  "specifier",
  "return import(specifier)"
) as <T = unknown>(specifier: string) => Promise<T>;

let nodeAvApiModule: NodeAvApiModule | null = null;
let loggingConfigured = false;

export async function loadNodeAvApi(): Promise<NodeAvApiModule> {
  if (nodeAvApiModule) {
    return nodeAvApiModule;
  }
  if (!loggingConfigured) {
    loggingConfigured = true;
    await configureNodeAvFfmpegLogging();
  }
  nodeAvApiModule = await dynamicImport<NodeAvApiModule>("node-av/api");
  return nodeAvApiModule;
}
