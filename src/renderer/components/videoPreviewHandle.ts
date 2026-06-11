export type VideoPreviewHandle = {
  togglePlay: () => void;
  armUserSeek?: (time: number) => void;
  seekToCompTime: (time: number) => void;
  stepFrame: (delta: number) => void;
};
