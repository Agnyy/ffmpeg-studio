import { loadNodeAvApi } from "./nodeAvLoader";

export type PreviewDecoderThreadConfig = {
  threadCount: number;
  threadType: number;
  threadTypeName: string;
};

let cachedConfig: PreviewDecoderThreadConfig | null = null;

/**
 * Single-threaded slice decode for preview stability (avoids libavcodec pthread_frame asserts).
 * node-av exposes `threadCount` and `threadType` on Decoder.create options.
 */
export async function getPreviewDecoderCreateOptions(): Promise<{
  threadCount: number;
  threadType: unknown;
}> {
  if (cachedConfig) {
    return {
      threadCount: cachedConfig.threadCount,
      threadType: cachedConfig.threadType,
    };
  }

  await loadNodeAvApi();
  const { FF_THREAD_SLICE } = await import("node-av/constants");
  cachedConfig = {
    threadCount: 1,
    threadType: FF_THREAD_SLICE,
    threadTypeName: "FF_THREAD_SLICE",
  };
  return {
    threadCount: cachedConfig.threadCount,
    threadType: cachedConfig.threadType,
  };
}

export function getPreviewDecoderConfigSummary(): string {
  if (!cachedConfig) {
    return "threadCount=1, threadType=FF_THREAD_SLICE (pending init)";
  }
  return `threadCount=${cachedConfig.threadCount}, threadType=${cachedConfig.threadTypeName}`;
}
