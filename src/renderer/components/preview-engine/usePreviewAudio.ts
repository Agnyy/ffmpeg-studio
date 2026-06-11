import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TimelineLayer } from "../../../shared/project";
import { getLayerPreviewVolume } from "../../utils/previewAudio";
import {
  PreviewAudioController,
  type PreviewAudioDebug,
  type PreviewAudioStatus,
} from "./PreviewAudioController";

type UsePreviewAudioOptions = {
  originalPath: string;
  previewLayer: TimelineLayer | null;
  compCurrentTime: number;
  sessionReady: boolean;
};

export function usePreviewAudio({
  originalPath,
  previewLayer,
  compCurrentTime,
  sessionReady,
}: UsePreviewAudioOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const controllerRef = useRef<PreviewAudioController | null>(null);
  const [audioStatus, setAudioStatus] = useState<PreviewAudioStatus>("idle");
  const [audioWarning, setAudioWarning] = useState<string | null>(null);
  const [userMuted, setUserMuted] = useState(false);

  if (!controllerRef.current) {
    controllerRef.current = new PreviewAudioController({
      getAudioElement: () => audioRef.current,
      onStatusChange: (status, warning) => {
        setAudioStatus(status);
        if (warning !== null) {
          setAudioWarning(warning);
        }
      },
    });
  }

  const controller = controllerRef.current;

  const fileUrl = useMemo(() => {
    if (!originalPath) {
      return "";
    }
    return window.ffmpegStudio.toFileUrl(originalPath);
  }, [originalPath]);

  useEffect(() => {
    if (!sessionReady || !originalPath || !fileUrl) {
      void controller.loadSource("", "");
      return;
    }
    void controller.loadSource(originalPath, fileUrl);
  }, [controller, fileUrl, originalPath, sessionReady]);

  useEffect(() => {
    if (!previewLayer) {
      controller.setVolume(1);
      return;
    }
    controller.setVolume(getLayerPreviewVolume(previewLayer, compCurrentTime));
  }, [compCurrentTime, controller, previewLayer]);

  useEffect(() => {
    if (!previewLayer) {
      return;
    }
    if (previewLayer.muted) {
      controller.setUserMuted(true);
    }
  }, [controller, previewLayer]);

  const toggleMute = useCallback(() => {
    const next = controller.toggleUserMuted();
    setUserMuted(next);
    return next;
  }, [controller]);

  const pauseAudio = useCallback(() => {
    controller.pause();
  }, [controller]);

  const seekAudio = useCallback(
    (sourceTime: number, play: boolean) => {
      controller.seekTo(sourceTime, { play });
    },
    [controller]
  );

  const playAudioAfterVideo = useCallback(
    async (sourceTime: number) => {
      await controller.playAfterVideo(sourceTime);
    },
    [controller]
  );

  const correctAudioDrift = useCallback(
    (engineSourceTime: number, isPlaying: boolean) => {
      controller.maybeCorrectDrift(engineSourceTime, isPlaying);
    },
    [controller]
  );

  const getAudioDebug = useCallback((): PreviewAudioDebug => {
    return controller.getDebug();
  }, [controller]);

  const audioStatusLabel = useMemo(() => {
    if (audioWarning && audioStatus === "unavailable") {
      return "Audio: unavailable";
    }
    if (audioWarning) {
      return `Audio: ${audioWarning}`;
    }
    switch (audioStatus) {
      case "ready":
        return "Audio: ready";
      case "muted":
        return "Audio: muted";
      case "loading":
        return "Audio: loading";
      case "unavailable":
        return "Audio: unavailable";
      default:
        return "";
    }
  }, [audioStatus, audioWarning]);

  return {
    audioRef,
    audioStatus,
    audioWarning,
    audioStatusLabel,
    toggleMute,
    pauseAudio,
    seekAudio,
    playAudioAfterVideo,
    correctAudioDrift,
    getAudioDebug,
    isUserMuted: userMuted,
  };
}
