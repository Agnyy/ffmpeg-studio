import { spawn } from "child_process";

export type FfmpegFilterInfo = {
  name: string;
  description: string;
};

let cachedFilters: Set<string> | null = null;
let cachedFilterList: FfmpegFilterInfo[] | null = null;
let cacheFfmpegPath: string | null = null;
const helpCache = new Map<string, string>();

function runFfmpegText(ffmpegPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { shell: false, windowsHide: true });
    let output = "";
    const append = (chunk: Buffer) => {
      output += chunk.toString();
    };
    proc.stdout.on("data", append);
    proc.stderr.on("data", append);
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0 && output.trim().length === 0) {
        reject(new Error(`ffmpeg exited with code ${code ?? 1}`));
        return;
      }
      resolve(output);
    });
  });
}

function parseFiltersOutput(text: string): FfmpegFilterInfo[] {
  const filters: FfmpegFilterInfo[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*[T\.|C]+\s+(\S+)\s+(.+)$/);
    if (!match) {
      continue;
    }
    const name = match[1];
    if (name === "filters" || name === "Sources:" || name === "name") {
      continue;
    }
    filters.push({ name, description: match[2].trim() });
  }
  return filters;
}

export async function listFfmpegFilters(ffmpegPath: string): Promise<FfmpegFilterInfo[]> {
  if (cacheFfmpegPath === ffmpegPath && cachedFilterList) {
    return cachedFilterList;
  }
  const text = await runFfmpegText(ffmpegPath, ["-hide_banner", "-filters"]);
  const list = parseFiltersOutput(text);
  cachedFilterList = list;
  cachedFilters = new Set(list.map((entry) => entry.name));
  cacheFfmpegPath = ffmpegPath;
  return list;
}

export async function hasFfmpegFilter(
  ffmpegPath: string,
  filterName: string
): Promise<boolean> {
  if (cacheFfmpegPath !== ffmpegPath) {
    await listFfmpegFilters(ffmpegPath);
  }
  return cachedFilters?.has(filterName) ?? false;
}

export async function hasAllFfmpegFilters(
  ffmpegPath: string,
  filterNames: string[]
): Promise<boolean> {
  if (filterNames.length === 0) {
    return true;
  }
  if (cacheFfmpegPath !== ffmpegPath) {
    await listFfmpegFilters(ffmpegPath);
  }
  return filterNames.every((name) => cachedFilters?.has(name));
}

export async function getFfmpegFilterHelp(
  ffmpegPath: string,
  filterName: string
): Promise<string> {
  const cacheKey = `${ffmpegPath}::${filterName}`;
  const cached = helpCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const text = await runFfmpegText(ffmpegPath, [
      "-hide_banner",
      `-h`,
      `filter=${filterName}`,
    ]);
    helpCache.set(cacheKey, text);
    return text;
  } catch {
    helpCache.set(cacheKey, "");
    return "";
  }
}

export function clearFfmpegFilterCache(): void {
  cachedFilters = null;
  cachedFilterList = null;
  cacheFfmpegPath = null;
  helpCache.clear();
}
