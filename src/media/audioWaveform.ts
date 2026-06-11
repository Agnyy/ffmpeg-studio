export type WaveformPeak = {
  min: number;
  max: number;
};

export async function generateWaveformPeaks(
  fileUrl: string,
  peakCount: number
): Promise<WaveformPeak[]> {
  const safePeakCount = Math.max(16, Math.min(peakCount, 512));
  const response = await fetch(fileUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    if (channel.length === 0) {
      return [];
    }

    const samplesPerPeak = Math.max(1, Math.floor(channel.length / safePeakCount));
    const peaks: WaveformPeak[] = [];

    for (let index = 0; index < safePeakCount; index++) {
      const start = index * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, channel.length);
      let min = 0;
      let max = 0;
      for (let sample = start; sample < end; sample++) {
        const value = channel[sample];
        if (value < min) {
          min = value;
        }
        if (value > max) {
          max = value;
        }
      }
      peaks.push({ min, max });
    }

    return peaks;
  } finally {
    await audioContext.close();
  }
}

export function sliceWaveformPeaks(
  peaks: WaveformPeak[],
  startRatio: number,
  endRatio: number
): WaveformPeak[] {
  if (peaks.length === 0) {
    return [];
  }
  const start = Math.max(0, Math.min(1, startRatio));
  const end = Math.max(start, Math.min(1, endRatio));
  const startIndex = Math.floor(start * peaks.length);
  const endIndex = Math.max(startIndex + 1, Math.ceil(end * peaks.length));
  return peaks.slice(startIndex, endIndex);
}
