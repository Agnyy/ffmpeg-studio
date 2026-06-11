import { useEffect, useRef } from "react";
import type { PreviewCacheState } from "../../shared/previewCache";

type PreviewCacheVideoProps = {
  cache: PreviewCacheState;
  isPlaying: boolean;
  playbackRate: number;
  onVideoElement: (video: HTMLVideoElement | null) => void;
  onEnded: () => void;
};

export default function PreviewCacheVideo({
  cache,
  isPlaying,
  playbackRate,
  onVideoElement,
  onEnded,
}: PreviewCacheVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cachePath = cache.path ?? "";
  const videoUrl = cachePath ? window.ffmpegStudio.toFileUrl(cachePath) : "";

  useEffect(() => {
    onVideoElement(videoRef.current);
    return () => onVideoElement(null);
  }, [onVideoElement, videoUrl]);

  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) {
      return;
    }
    video.playbackRate = playbackRate;
    if (isPlaying) {
      void video.play().catch(() => video.pause());
    } else {
      video.pause();
    }
  }, [isPlaying, playbackRate, videoUrl]);

  if (!videoUrl) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      className="video-player preview-cache-video"
      src={videoUrl}
      preload="metadata"
      playsInline
      onEnded={onEnded}
    />
  );
}
