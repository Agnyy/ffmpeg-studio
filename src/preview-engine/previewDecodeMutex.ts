const IDLE_POLL_MS = 5;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Serializes every node-av / FFmpeg operation (demuxer, decoder, scaler).
 * Prevents overlapping decodeAll / dispose / seek that trigger libavcodec pthread_frame asserts.
 */
export class PreviewDecodeMutex {
  private chain: Promise<void> = Promise.resolve();
  private decodingPacket = false;
  private scalingFrame = false;
  private readingPacket = false;
  private closingContext = false;

  get isBusy(): boolean {
    return this.decodingPacket || this.scalingFrame || this.readingPacket || this.closingContext;
  }

  getActivitySnapshot(): {
    decodingPacket: boolean;
    scalingFrame: boolean;
    readingPacket: boolean;
    closingContext: boolean;
  } {
    return {
      decodingPacket: this.decodingPacket,
      scalingFrame: this.scalingFrame,
      readingPacket: this.readingPacket,
      closingContext: this.closingContext,
    };
  }

  async waitForIdle(timeoutMs = DEFAULT_IDLE_TIMEOUT_MS): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.isBusy) {
      if (Date.now() >= deadline) {
        throw new Error("Timed out waiting for native FFmpeg idle");
      }
      await sleep(IDLE_POLL_MS);
    }
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      await this.waitForIdle();
      return fn();
    });
    this.chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async withReadingPacket<T>(fn: () => Promise<T>): Promise<T> {
    this.readingPacket = true;
    try {
      return await fn();
    } finally {
      this.readingPacket = false;
    }
  }

  async withDecodingPacket<T>(fn: () => Promise<T>): Promise<T> {
    this.decodingPacket = true;
    try {
      return await fn();
    } finally {
      this.decodingPacket = false;
    }
  }

  async withScalingFrame<T>(fn: () => Promise<T>): Promise<T> {
    this.scalingFrame = true;
    try {
      return await fn();
    } finally {
      this.scalingFrame = false;
    }
  }

  async withClosingContext<T>(fn: () => Promise<T>): Promise<T> {
    this.closingContext = true;
    try {
      return await fn();
    } finally {
      this.closingContext = false;
    }
  }
}

export const previewDecodeMutex = new PreviewDecodeMutex();
