import { mkdirSync } from "fs";
import { join } from "path";
import { app } from "electron";

export function getPreviewProxyPath(projectItemId: string): string {
  const proxyDir = join(app.getPath("userData"), "proxies");
  mkdirSync(proxyDir, { recursive: true });
  return join(proxyDir, `${projectItemId}_preview_proxy.mp4`);
}

export function getPreviewCachePath(cacheId: string): string {
  const cacheDir = join(app.getPath("userData"), "preview-cache");
  mkdirSync(cacheDir, { recursive: true });
  return join(cacheDir, `${cacheId}_preview_cache.mp4`);
}

export function getPrecompRenderCachePath(
  renderJobId: string,
  precompLayerId: string
): string {
  const cacheDir = join(app.getPath("userData"), "render-cache", "precomps");
  mkdirSync(cacheDir, { recursive: true });
  return join(cacheDir, `${renderJobId}_${precompLayerId}.mp4`);
}
