import type { ProjectItem } from "../shared/project";
import { extractThumbnailDataUrl } from "./thumbnailDebugPipe";

export type TimelineThumbnail = {
  time: number;
  dataUrl: string;
};

/** Timeline strip thumbnails via FFmpeg main-process pipe — never Chromium &lt;video&gt;. */
export async function generateTimelineThumbnails(
  item: ProjectItem,
  duration: number,
  options: {
    count: number;
    width: number;
    height: number;
  }
): Promise<TimelineThumbnail[]> {
  const inputPath = item.originalPath ?? item.path;
  if (!inputPath || item.type !== "footage") {
    return [];
  }

  const safeDuration = Math.max(duration, 0.1);
  const count = Math.max(1, Math.min(options.count, 20));
  const thumbnails: TimelineThumbnail[] = [];

  for (let index = 0; index < count; index++) {
    const ratio = count === 1 ? 0.5 : index / (count - 1);
    const time = Math.min(
      safeDuration * ratio,
      Math.max(safeDuration - 0.05, 0)
    );
    try {
      const result = await window.ffmpegStudio.thumbnailAtTime(inputPath, time);
      const dataUrl = extractThumbnailDataUrl(result);
      if (dataUrl) {
        thumbnails.push({ time, dataUrl });
      }
    } catch {
      // Skip failed frames; caller may show fallback strip.
    }
  }

  return thumbnails;
}
