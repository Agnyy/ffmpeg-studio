import { useEffect, useRef } from "react";
import { sliceWaveformPeaks, type WaveformPeak } from "../../media/audioWaveform";

type AudioWaveformProps = {
  peaks: WaveformPeak[];
  width: number;
  height: number;
  inPoint: number;
  outPoint: number;
  sourceDuration: number;
  muted?: boolean;
  loading?: boolean;
};

export default function AudioWaveform({
  peaks,
  width,
  height,
  inPoint,
  outPoint,
  sourceDuration,
  muted = false,
  loading = false,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const drawWidth = Math.max(1, Math.floor(width));
    const drawHeight = Math.max(1, Math.floor(height));
    canvas.width = drawWidth;
    canvas.height = drawHeight;
    ctx.clearRect(0, 0, drawWidth, drawHeight);

    if (peaks.length === 0) {
      ctx.fillStyle = muted ? "rgba(56, 189, 248, 0.2)" : "rgba(56, 189, 248, 0.35)";
      const barWidth = 3;
      const gap = 2;
      for (let x = 0; x < drawWidth; x += barWidth + gap) {
        const barHeight = drawHeight * (0.25 + ((x / drawWidth) % 0.5));
        ctx.fillRect(x, (drawHeight - barHeight) / 2, barWidth, barHeight);
      }
      return;
    }

    const startRatio = sourceDuration > 0 ? inPoint / sourceDuration : 0;
    const endRatio = sourceDuration > 0 ? outPoint / sourceDuration : 1;
    const segmentPeaks = sliceWaveformPeaks(peaks, startRatio, endRatio);
    const midY = drawHeight / 2;
    const barWidth = Math.max(1, drawWidth / segmentPeaks.length);

    ctx.fillStyle = muted ? "rgba(56, 189, 248, 0.28)" : "rgba(56, 189, 248, 0.72)";
    for (let index = 0; index < segmentPeaks.length; index++) {
      const peak = segmentPeaks[index];
      const amplitude = Math.max(Math.abs(peak.min), Math.abs(peak.max));
      const barHeight = Math.max(2, amplitude * drawHeight * 0.92);
      const x = index * barWidth;
      ctx.fillRect(x, midY - barHeight / 2, Math.max(1, barWidth - 0.5), barHeight);
    }
  }, [height, inPoint, loading, muted, outPoint, peaks, sourceDuration, width]);

  if (loading) {
    return <div className="timeline-waveform timeline-waveform-loading" style={{ width, height }} />;
  }

  return (
    <canvas
      ref={canvasRef}
      className={`timeline-waveform ${muted ? "muted" : ""}`}
      style={{ width, height }}
    />
  );
}
