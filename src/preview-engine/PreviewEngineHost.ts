import type {
  PreviewEngineCloseResult,
  PreviewEngineFrameResult,
  PreviewEngineOpenResult,
  PreviewEngineSeekResult,
  PreviewEngineStateResult,
} from "./ipcTypes";
import { logMainEngineFrame } from "./frameDiagnostics";
import { toIpcFrame } from "./ipcFrame";
import { VideoPlayerSession } from "./videoPlayerSession";
import type { QueuedVideoFrame } from "./types";

class PreviewEngineHost {
  private session: VideoPlayerSession | null = null;
  private loggedFirstMainFrame = false;

  async open(filePath: string): Promise<PreviewEngineOpenResult> {
    await this.close();

    const session = new VideoPlayerSession(filePath);
    const opened = await session.open();
    if (!opened) {
      const errors = session.getMetrics().errors;
      await session.close();
      return { ok: false, error: errors[0] ?? "Preview engine open failed" };
    }

    const initialFrame = session.getCurrentFrame();
    if (!initialFrame) {
      await session.close();
      return { ok: false, error: "Preview engine opened but no initial frame" };
    }

    session.startUi();
    this.session = session;

    const metadata = session.getMetadata();
    const ipcInitialFrame = this.toIpcFrame(initialFrame, true);
    this.logFirstMainFrame(ipcInitialFrame);

    return {
      ok: true,
      metadata: metadata ?? undefined,
      hasCurrentFrame: true,
      initialFrame: ipcInitialFrame,
    };
  }

  async close(): Promise<PreviewEngineCloseResult> {
    if (!this.session) {
      return { ok: true };
    }
    try {
      await this.session.close();
      this.session = null;
      this.loggedFirstMainFrame = false;
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async play(sourceTime?: number): Promise<PreviewEngineSeekResult> {
    if (!this.session) {
      return { ok: false, error: "Preview engine not open" };
    }

    if (sourceTime !== undefined && Number.isFinite(sourceTime)) {
      const result = await this.session.playFrom(sourceTime);
      const playheadSec = this.session.getPlayhead();
      if (result.cancelled) {
        return {
          ok: false,
          playheadSec,
          warning: "Play start superseded by a newer request",
        };
      }
      if (!result.ok) {
        return {
          ok: false,
          playheadSec,
          error: result.warning ?? "Preview engine play failed",
          warning: result.warning,
        };
      }
      const frame = result.frame ? this.toIpcFrame(result.frame, true) : undefined;
      this.logFirstMainFrame(frame ?? { ok: false, width: 0, height: 0, timeSec: playheadSec });
      return {
        ok: true,
        playheadSec,
        frame,
      };
    }

    const result = await this.session.playFrom(this.session.getPlayhead());
    const playheadSec = this.session.getPlayhead();
    if (!result.ok) {
      return {
        ok: false,
        playheadSec,
        error: result.warning ?? "Preview engine play failed",
        warning: result.warning,
      };
    }
    return { ok: true, playheadSec };
  }

  pause(): PreviewEngineSeekResult {
    if (!this.session) {
      return { ok: false, error: "Preview engine not open" };
    }
    this.session.pause();
    return { ok: true, playheadSec: this.session.getPlayhead() };
  }

  async seek(timeSec: number): Promise<PreviewEngineSeekResult> {
    if (!this.session) {
      return { ok: false, error: "Preview engine not open" };
    }
    try {
      const result = this.session.isPlaying()
        ? await this.session.requestSeekDuringPlayback(timeSec)
        : await this.session.seekAndHold(timeSec);
      if (result.cancelled) {
        return {
          ok: false,
          playheadSec: this.session.getPlayhead(),
          warning: "Seek superseded by a newer request",
        };
      }
      const playheadSec = this.session.getPlayhead();

      if (result.frame) {
        const frame = this.toIpcFrame(result.frame, true);
        return {
          ok: true,
          playheadSec,
          frame,
          warning: result.warning,
        };
      }

      return {
        ok: false,
        playheadSec,
        error: result.warning ?? "No frame decoded for seek",
        warning: result.warning,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getState(): PreviewEngineStateResult {
    if (!this.session) {
      return {
        ok: false,
        playheadSec: 0,
        isPlaying: false,
        error: "Preview engine not open",
      };
    }
    return {
      ok: true,
      playheadSec: this.session.getPlayhead(),
      isPlaying: this.session.isPlaying(),
      enginePhase: this.session.getEnginePhase(),
      previewBufferedRanges: this.session.getPreviewBufferedRanges(),
      bufferingRange: this.session.getActiveBufferingRange(),
      queueDepth: this.session.getQueueDepth(),
      queueMinTimeSec: this.session.getQueueTimeRange().min,
      queueMaxTimeSec: this.session.getQueueTimeRange().max,
      decodedFrames: this.session.getMetrics().decodedFrames,
      hasCurrentFrame: this.session.hasCurrentFrame(),
      metadata: this.session.getMetadata() ?? undefined,
    };
  }

  pollFrame(): PreviewEngineFrameResult {
    if (!this.session) {
      return {
        ok: false,
        width: 0,
        height: 0,
        timeSec: 0,
        error: "Preview engine not open",
      };
    }

    const pulled = this.session.pullDisplayFrame();
    if (!pulled) {
      return {
        ok: false,
        width: 0,
        height: 0,
        timeSec: this.session.getPlayhead(),
        queueDepth: this.session.getQueueDepth(),
        error: "No frame available",
      };
    }

    const ipcFrame = this.toIpcFrame(pulled.frame, pulled.isNew);
    this.logFirstMainFrame(ipcFrame);
    return ipcFrame;
  }

  private toIpcFrame(frame: QueuedVideoFrame, isNew: boolean): PreviewEngineFrameResult {
    return toIpcFrame(frame, {
      queueDepth: this.session!.getQueueDepth(),
      isNew,
    });
  }

  private logFirstMainFrame(frame: PreviewEngineFrameResult): void {
    if (this.loggedFirstMainFrame || !frame.ok || !frame.rgba) {
      return;
    }
    this.loggedFirstMainFrame = true;
    logMainEngineFrame({
      width: frame.width,
      height: frame.height,
      rgba: frame.rgba,
      timeSec: frame.timeSec,
    });
  }
}

export const previewEngineHost = new PreviewEngineHost();
