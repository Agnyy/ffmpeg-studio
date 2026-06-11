import type {
  PreviewCloseResult,
  PreviewFrameResult,
  PreviewMetadata,
  PreviewOpenResult,
  PreviewSeekResult,
} from "./types";
import { decodeNodeAvFrameAt } from "./nodeAvFrameDecode";
import { AVSEEK_FLAG_BACKWARD } from "./nodeAvConstants";
import { loadNodeAvApi, loadNodeAvLib } from "./nodeAvLoader";
import type { NodeAvFrame } from "./nodeAvTypes";

const MAX_PREVIEW_WIDTH = 1280;

type NodeAvApiModule = Awaited<ReturnType<typeof loadNodeAvApi>>;

export class NodeAvPreviewService {
  // Runtime node-av instances — typed as any to avoid static node-av imports.
  private demuxer: any = null;
  private decoder: any = null;
  private scaler: any = null;
  private videoStream: any = null;
  private videoStreamIndex = -1;
  private hasDecodedFrame = false;
  private filePath: string | null = null;
  private metadata: PreviewMetadata | null = null;
  private nodeAvApi: NodeAvApiModule | null = null;

  private async ensureNodeAv(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (this.nodeAvApi) {
      return { ok: true };
    }
    try {
      this.nodeAvApi = await loadNodeAvApi();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private disposeDecoder(): void {
    if (this.decoder) {
      this.decoder[Symbol.dispose]?.();
      this.decoder = null;
    }
    if (this.scaler) {
      this.scaler[Symbol.dispose]?.();
      this.scaler = null;
    }
  }

  private async closeDemuxer(): Promise<void> {
    if (this.demuxer) {
      await this.demuxer.close();
      this.demuxer = null;
    }
  }

  private async resetDecoder(): Promise<void> {
    if (!this.videoStream || !this.nodeAvApi) {
      return;
    }
    if (this.decoder) {
      this.decoder[Symbol.dispose]?.();
    }
    this.decoder = await this.nodeAvApi.Decoder.create(this.videoStream);
  }

  private async frameToPreviewResult(
    decodedFrame: NodeAvFrame,
    requestedTimeSec: number,
    actualTimeSec: number | null,
    usedFallback: boolean
  ): Promise<PreviewFrameResult> {
    const resize =
      decodedFrame.width > MAX_PREVIEW_WIDTH
        ? {
            width: MAX_PREVIEW_WIDTH,
            height: Math.max(
              2,
              Math.round(
                (MAX_PREVIEW_WIDTH / decodedFrame.width) * decodedFrame.height
              )
            ),
          }
        : undefined;

    const rgbaBuffer = await this.scaler!.toBuffer(decodedFrame, {
      format: "rgba",
      resize,
    });
    const pngBuffer = await this.scaler!.toPng(decodedFrame, {
      format: "rgb",
      resize,
    });

    const outWidth = resize?.width ?? decodedFrame.width;
    const outHeight = resize?.height ?? decodedFrame.height;
    const resolvedActual = actualTimeSec ?? requestedTimeSec;

    return {
      ok: true,
      width: outWidth,
      height: outHeight,
      rgba: new Uint8Array(
        rgbaBuffer.buffer,
        rgbaBuffer.byteOffset,
        rgbaBuffer.byteLength
      ),
      dataUrl: `data:image/png;base64,${pngBuffer.toString("base64")}`,
      sourceTimeSec: resolvedActual,
      requestedTimeSec,
      actualTimeSec: resolvedActual,
      usedFallback,
    };
  }

  async open(filePath: string): Promise<PreviewOpenResult> {
    await this.close();

    try {
      const ready = await this.ensureNodeAv();
      if (!ready.ok) {
        return { ok: false, error: ready.error };
      }

      const { Demuxer, Decoder, Scaler, probe } = this.nodeAvApi!;

      const probeInfo = await probe(filePath);
      const video = probeInfo.video;

      this.demuxer = await Demuxer.open(filePath);
      const videoStream = this.demuxer.video();
      if (!videoStream) {
        await this.closeDemuxer();
        return { ok: false, error: "No video stream found" };
      }

      this.videoStream = videoStream;
      this.videoStreamIndex = videoStream.index;
      this.decoder = await Decoder.create(videoStream);
      this.scaler = new Scaler();
      this.filePath = filePath;

      this.metadata = {
        duration:
          probeInfo.duration > 0
            ? probeInfo.duration
            : this.demuxer.duration > 0
              ? this.demuxer.duration
              : 0,
        width: video?.width ?? videoStream.codecpar.width,
        height: video?.height ?? videoStream.codecpar.height,
        fps: video?.frameRate ?? 30,
        pixelFormat: video?.pixelFormat ?? "unknown",
        codec: video?.codec ?? "unknown",
      };

      return { ok: true, metadata: this.metadata };
    } catch (error) {
      await this.close();
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getMetadata(): PreviewMetadata | null {
    return this.metadata;
  }

  async seek(timeSec: number): Promise<PreviewSeekResult> {
    if (!this.demuxer || this.videoStreamIndex < 0) {
      return { ok: false, error: "Preview session not open" };
    }

    try {
      const ready = await this.ensureNodeAv();
      if (!ready.ok) {
        return { ok: false, error: ready.error };
      }

      const ret = await this.demuxer.seek(
        Math.max(0, timeSec),
        this.videoStreamIndex,
        AVSEEK_FLAG_BACKWARD
      );
      if (ret < 0) {
        try {
          const { FFmpegError } = await loadNodeAvLib();
          return { ok: false, error: new FFmpegError(ret).message };
        } catch {
          return { ok: false, error: `Seek failed (${ret})` };
        }
      }
      await this.resetDecoder();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async decodeFrameAt(timeSec: number): Promise<PreviewFrameResult> {
    if (
      !this.demuxer ||
      !this.decoder ||
      !this.scaler ||
      !this.videoStream ||
      this.videoStreamIndex < 0
    ) {
      return {
        ok: false,
        width: 0,
        height: 0,
        sourceTimeSec: timeSec,
        requestedTimeSec: timeSec,
        error: "Preview session not open",
      };
    }

    try {
      const ready = await this.ensureNodeAv();
      if (!ready.ok) {
        return {
          ok: false,
          width: 0,
          height: 0,
          sourceTimeSec: timeSec,
          requestedTimeSec: timeSec,
          error: ready.error,
        };
      }

      const outcome = await decodeNodeAvFrameAt(
        this.videoStreamIndex,
        this.videoStream,
        timeSec,
        {
          seekFlags: AVSEEK_FLAG_BACKWARD,
          formatDurationSec: this.metadata?.duration ?? 0,
          readFromStart: !this.hasDecodedFrame,
          getDemuxer: () => this.demuxer,
          getDecoder: () => this.decoder,
          resetDecoder: async () => {
            await this.resetDecoder();
          },
          log: (message) => console.warn(message),
        }
      );

      if (!outcome.decoded) {
        return {
          ok: false,
          width: 0,
          height: 0,
          sourceTimeSec: timeSec,
          requestedTimeSec: outcome.requestedTimeSec,
          error: "No frame decoded after seek",
        };
      }

      this.hasDecodedFrame = true;

      return await this.frameToPreviewResult(
        outcome.decoded.frame,
        outcome.requestedTimeSec,
        outcome.decoded.actualTimeSec,
        outcome.usedFallback
      );
    } catch (error) {
      return {
        ok: false,
        width: 0,
        height: 0,
        sourceTimeSec: timeSec,
        requestedTimeSec: timeSec,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async close(): Promise<PreviewCloseResult> {
    try {
      this.disposeDecoder();
      await this.closeDemuxer();
      this.videoStream = null;
      this.videoStreamIndex = -1;
      this.hasDecodedFrame = false;
      this.filePath = null;
      this.metadata = null;
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getOpenFilePath(): string | null {
    return this.filePath;
  }
}
