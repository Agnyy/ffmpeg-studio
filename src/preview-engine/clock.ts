export class MasterClock {
  private anchorWallMs = 0;
  private anchorPlayheadSec = 0;
  private playing = false;
  private pausedAtSec: number | null = null;

  start(atSec = 0): void {
    this.anchorPlayheadSec = atSec;
    this.anchorWallMs = performance.now();
    this.playing = true;
    this.pausedAtSec = null;
  }

  pause(): number {
    const current = this.now();
    this.playing = false;
    this.pausedAtSec = current;
    return current;
  }

  resume(): void {
    if (this.playing) {
      return;
    }
    this.anchorPlayheadSec = this.pausedAtSec ?? this.anchorPlayheadSec;
    this.anchorWallMs = performance.now();
    this.playing = true;
    this.pausedAtSec = null;
  }

  seek(toSec: number): void {
    this.anchorPlayheadSec = Math.max(0, toSec);
    this.anchorWallMs = performance.now();
    if (!this.playing && this.pausedAtSec !== null) {
      this.pausedAtSec = this.anchorPlayheadSec;
    }
  }

  now(): number {
    if (!this.playing && this.pausedAtSec !== null) {
      return this.pausedAtSec;
    }
    return this.anchorPlayheadSec + (performance.now() - this.anchorWallMs) / 1000;
  }

  isPlaying(): boolean {
    return this.playing;
  }
}
