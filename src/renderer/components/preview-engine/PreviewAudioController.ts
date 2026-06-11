const DRIFT_CORRECT_THRESHOLD_SEC = 0.12;
const DRIFT_CHECK_MIN_INTERVAL_MS = 300;

export type PreviewAudioStatus = "idle" | "loading" | "ready" | "muted" | "unavailable";

export type PreviewAudioDebug = {
  hasAudioElement: boolean;
  src: string;
  readyState: number;
  paused: boolean;
  muted: boolean;
  currentTime: number;
  duration: number;
  errorCode: number | null;
  status: PreviewAudioStatus;
  warning: string | null;
};

export type PreviewAudioControllerOptions = {
  getAudioElement: () => HTMLAudioElement | null;
  onStatusChange?: (status: PreviewAudioStatus, warning: string | null) => void;
};

export class PreviewAudioController {
  private sourcePath = "";
  private sourceUrl = "";
  private status: PreviewAudioStatus = "idle";
  private warning: string | null = null;
  private userMuted = false;
  private volume = 1;
  private lastDriftCheckMs = 0;
  private loadGeneration = 0;

  constructor(private readonly options: PreviewAudioControllerOptions) {}

  getStatus(): PreviewAudioStatus {
    return this.status;
  }

  getWarning(): string | null {
    return this.warning;
  }

  setUserMuted(muted: boolean): void {
    this.userMuted = muted;
    const audio = this.options.getAudioElement();
    if (audio) {
      audio.muted = muted;
    }
    this.updateStatusFromElement();
  }

  toggleUserMuted(): boolean {
    this.setUserMuted(!this.userMuted);
    return this.userMuted;
  }

  isUserMuted(): boolean {
    return this.userMuted;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    const audio = this.options.getAudioElement();
    if (audio) {
      audio.volume = this.volume;
    }
  }

  async loadSource(filePath: string, fileUrl: string): Promise<void> {
    const audio = this.options.getAudioElement();
    if (!audio || !filePath) {
      this.sourcePath = "";
      this.sourceUrl = "";
      this.setStatus("idle", null);
      return;
    }

    if (this.sourcePath === filePath && this.sourceUrl === fileUrl) {
      return;
    }

    const generation = ++this.loadGeneration;
    this.sourcePath = filePath;
    this.sourceUrl = fileUrl;
    this.setStatus("loading", null);

    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    return new Promise((resolve) => {
      const onReady = () => {
        cleanup();
        if (generation !== this.loadGeneration) {
          resolve();
          return;
        }
        audio.volume = this.volume;
        audio.muted = this.userMuted;
        this.setStatus(this.userMuted ? "muted" : "ready", null);
        resolve();
      };

      const onError = () => {
        cleanup();
        if (generation !== this.loadGeneration) {
          resolve();
          return;
        }
        this.setStatus("unavailable", "audio unavailable");
        resolve();
      };

      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", onReady);
        audio.removeEventListener("canplay", onReady);
        audio.removeEventListener("error", onError);
      };

      audio.addEventListener("loadedmetadata", onReady, { once: true });
      audio.addEventListener("canplay", onReady, { once: true });
      audio.addEventListener("error", onError, { once: true });
      audio.src = fileUrl;
      audio.load();
    });
  }

  seekTo(sourceTime: number, options?: { play?: boolean }): void {
    const audio = this.options.getAudioElement();
    if (!audio || this.status === "unavailable" || this.status === "idle") {
      return;
    }

    const clamped = Math.max(0, sourceTime);
    try {
      audio.currentTime = clamped;
    } catch {
      // ignore seek before metadata
    }

    if (options?.play) {
      void this.playAt(clamped);
    }
  }

  async playAfterVideo(sourceTime: number): Promise<void> {
    const audio = this.options.getAudioElement();
    if (!audio || this.status === "unavailable" || this.status === "idle") {
      return;
    }

    const clamped = Math.max(0, sourceTime);
    try {
      audio.currentTime = clamped;
    } catch {
      // ignore
    }
    await this.playAt(clamped);
  }

  pause(): void {
    const audio = this.options.getAudioElement();
    if (!audio) {
      return;
    }
    audio.pause();
    this.updateStatusFromElement();
  }

  maybeCorrectDrift(engineSourceTime: number, isPlaying: boolean): void {
    if (!isPlaying) {
      return;
    }
    const now = performance.now();
    if (now - this.lastDriftCheckMs < DRIFT_CHECK_MIN_INTERVAL_MS) {
      return;
    }
    this.lastDriftCheckMs = now;

    const audio = this.options.getAudioElement();
    if (!audio || audio.paused || this.status === "unavailable") {
      return;
    }

    const drift = Math.abs(audio.currentTime - engineSourceTime);
    if (drift > DRIFT_CORRECT_THRESHOLD_SEC) {
      try {
        audio.currentTime = engineSourceTime;
      } catch {
        // ignore
      }
    }
  }

  getDebug(): PreviewAudioDebug {
    const audio = this.options.getAudioElement();
    return {
      hasAudioElement: Boolean(audio),
      src: audio?.currentSrc ?? audio?.src ?? this.sourceUrl,
      readyState: audio?.readyState ?? 0,
      paused: audio?.paused ?? true,
      muted: audio?.muted ?? this.userMuted,
      currentTime: audio?.currentTime ?? 0,
      duration: Number.isFinite(audio?.duration) ? audio!.duration : 0,
      errorCode: audio?.error?.code ?? null,
      status: this.status,
      warning: this.warning,
    };
  }

  private async playAt(_sourceTime: number): Promise<void> {
    const audio = this.options.getAudioElement();
    if (!audio || this.status === "unavailable" || this.status === "idle") {
      return;
    }

    audio.volume = this.volume;
    audio.muted = this.userMuted;

    try {
      await audio.play();
      this.setWarning(null);
      this.updateStatusFromElement();
    } catch (error) {
      const message =
        error instanceof Error && error.name === "NotAllowedError"
          ? "audio blocked by browser autoplay policy"
          : "audio unavailable";
      this.setWarning(message);
      this.updateStatusFromElement();
    }
  }

  private setStatus(status: PreviewAudioStatus, warning: string | null): void {
    this.status = status;
    if (warning !== null) {
      this.warning = warning;
    }
    this.options.onStatusChange?.(this.status, this.warning);
  }

  private setWarning(warning: string | null): void {
    this.warning = warning;
    this.options.onStatusChange?.(this.status, this.warning);
  }

  private updateStatusFromElement(): void {
    const audio = this.options.getAudioElement();
    if (!audio) {
      this.setStatus("idle", this.warning);
      return;
    }
    if (audio.error) {
      this.setStatus("unavailable", "audio unavailable");
      return;
    }
    if (this.userMuted) {
      this.setStatus("muted", this.warning);
      return;
    }
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      this.setStatus("ready", this.warning);
      return;
    }
    if (this.sourceUrl) {
      this.setStatus("loading", this.warning);
    }
  }
}

export { DRIFT_CORRECT_THRESHOLD_SEC };
