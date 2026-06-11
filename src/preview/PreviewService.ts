import { ChromiumPreviewService } from "./ChromiumPreviewService";
import { NodeAvPreviewService } from "./NodeAvPreviewService";
import type {
  PreviewBackend,
  PreviewCloseResult,
  PreviewFrameResult,
  PreviewMetadata,
  PreviewOpenResult,
  PreviewSeekResult,
} from "./types";

export type { PreviewBackend, PreviewMetadata, PreviewOpenResult, PreviewFrameResult } from "./types";

export class PreviewService {
  private readonly nodeAv = new NodeAvPreviewService();
  private readonly chromium = new ChromiumPreviewService();
  private activeBackend: PreviewBackend | null = null;

  async open(filePath: string, backend: PreviewBackend): Promise<PreviewOpenResult> {
    await this.close();

    if (backend === "node-av") {
      const result = await this.nodeAv.open(filePath);
      if (result.ok) {
        this.activeBackend = "node-av";
      }
      return result;
    }

    return this.chromium.open(filePath);
  }

  getMetadata(): PreviewMetadata | null {
    if (this.activeBackend === "node-av") {
      return this.nodeAv.getMetadata();
    }
    return null;
  }

  async seek(timeSec: number): Promise<PreviewSeekResult> {
    if (this.activeBackend === "node-av") {
      return this.nodeAv.seek(timeSec);
    }
    return this.chromium.seek(timeSec);
  }

  async decodeFrameAt(timeSec: number): Promise<PreviewFrameResult> {
    if (this.activeBackend === "node-av") {
      return this.nodeAv.decodeFrameAt(timeSec);
    }
    return this.chromium.decodeFrameAt(timeSec);
  }

  async close(): Promise<PreviewCloseResult> {
    const wasNodeAv = this.activeBackend === "node-av";
    this.activeBackend = null;
    if (wasNodeAv) {
      return this.nodeAv.close();
    }
    return this.chromium.close();
  }

  getActiveBackend(): PreviewBackend | null {
    return this.activeBackend;
  }

  getOpenFilePath(): string | null {
    if (this.activeBackend === "node-av") {
      return this.nodeAv.getOpenFilePath();
    }
    return null;
  }
}

export const previewService = new PreviewService();
