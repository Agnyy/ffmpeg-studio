import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MediaInfo } from "../../../shared/types";
import type { ProjectItem, TimelineLayer } from "../../../shared/project";
import {
  getLayerSourceTime,
  isLayerVisibleAtCompTime,
  sourceTimeToCompTime,
} from "../../../shared/project";
import { getEffectiveLayerTransform } from "../../../keyframes/layerTransformKeyframes";
import PlaybackControls from "../PlaybackControls";
import type { VideoPreviewHandle } from "../videoPreviewHandle";
import { frameDuration, snapTimeToFrame } from "../../utils/time";
import { formatDuration, formatFps } from "../../utils/format";
import {
  getCompCanvasLayout,
  getLayerDisplayGeometry,
  getLayerSourceSize,
} from "../../utils/layerTransform";
import { resolveEnginePreviewLayer } from "./resolveEnginePreviewLayer";
import { rgbaFromIpc } from "./rgbaFromIpc";
import type { PreviewEngineFrameResult } from "../../../preview-engine/ipcTypes";
import {
  drawRgbaToCanvas,
  logRendererEngineFrame,
  rgbaChecksum,
} from "./engineCanvasDraw";
import { canvasChecksum } from "../../previewE2e/canvasChecksum";
import {
  registerPreviewE2eDebug,
  shouldRegisterPreviewE2eDebug,
  unregisterPreviewE2eDebug,
} from "../../previewE2e/previewE2eDebug";
import {
  LOG_TIMELINE_SEEK_DEBUG,
  logEngineSeekProp,
} from "../../utils/timelineSeekDebug";
import type {
  PreviewBufferedRange,
  PreviewBufferState,
} from "../../../shared/previewBufferedRanges";
import { usePreviewAudio } from "./usePreviewAudio";

const importMetaEnv = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
const SHOW_ENGINE_DEV_DIAG =
  importMetaEnv?.DEV === true && importMetaEnv?.VITE_ENGINE_PREVIEW_DEV_DIAG === "1";
const LOG_TIMELINE_SEEK_FLOW = LOG_TIMELINE_SEEK_DEBUG;

type TimelineSeekFlowLog = {
  compTime: number;
  sourceTime: number | null;
  layerId: string | null;
  seekResultOk: boolean;
  hasFrame: boolean;
  drawOk: boolean;
  note?: string;
};

function logTimelineSeekFlow(payload: TimelineSeekFlowLog): void {
  if (!LOG_TIMELINE_SEEK_FLOW) {
    return;
  }
  const parts = [
    "[TIMELINE_SEEK_FLOW]",
    `compTime=${payload.compTime.toFixed(3)}`,
    `sourceTime=${payload.sourceTime === null ? "null" : payload.sourceTime.toFixed(3)}`,
    `layerId=${payload.layerId ?? "null"}`,
    `seekResult.ok=${payload.seekResultOk ? "yes" : "no"}`,
    `hasFrame=${payload.hasFrame ? "yes" : "no"}`,
    `drawOk=${payload.drawOk ? "yes" : "no"}`,
  ];
  if (payload.note) {
    parts.push(`note=${payload.note}`);
  }
  console.log(parts.join(" "));
}

type FrameDiagnostics = {
  frameStatus: "none" | "ok";
  width: number;
  height: number;
  rgbaBytes: number;
  checksum: number;
  drawCount: number;
  canvasSize: string;
  lastError: string;
  testPattern: boolean;
};

type EnginePreviewStatus =
  | "idle"
  | "opening"
  | "loading engine"
  | "opening file"
  | "decoding frame"
  | "ready"
  | "playing"
  | "paused"
  | "seeking"
  | "buffering"
  | "engine error";

type EnginePreviewPanelProps = {
  timelineLayers: TimelineLayer[];
  projectItems: ProjectItem[];
  mediaInfoByPath: Record<string, MediaInfo | undefined>;
  compositionName?: string | null;
  compWidth: number;
  compHeight: number;
  selectedLayer: TimelineLayer | null;
  compCurrentTime: number;
  compDuration: number;
  playbackRate: number;
  loop: boolean;
  seekTime: number | null;
  onAddMedia: () => void;
  isPlaying: boolean;
  onCurrentTimeChange: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onPlaybackRateChange: (rate: number) => void;
  onToggleLoop: () => void;
  onPreviewBufferStateChange?: (state: PreviewBufferState) => void;
};

function sourceRangeToCompRange(
  layer: TimelineLayer,
  range: PreviewBufferedRange
): PreviewBufferedRange {
  const compStart = sourceTimeToCompTime(layer, range.start);
  const compEnd = sourceTimeToCompTime(layer, range.end);
  return {
    start: Math.min(compStart, compEnd),
    end: Math.max(compStart, compEnd),
  };
}

function mapEngineBufferStateToComp(
  layer: TimelineLayer,
  previewBufferedRanges: PreviewBufferedRange[],
  bufferingRange: PreviewBufferedRange | null | undefined
): PreviewBufferState {
  return {
    previewBufferedRanges: previewBufferedRanges.map((range) =>
      sourceRangeToCompRange(layer, range)
    ),
    bufferingRange: bufferingRange ? sourceRangeToCompRange(layer, bufferingRange) : null,
  };
}

function previewBufferStateKey(state: PreviewBufferState): string {
  const snap = (value: number) => Math.round(value * 2) / 2;
  const snapRange = (range: PreviewBufferedRange) => ({
    start: snap(range.start),
    end: snap(range.end),
  });
  return JSON.stringify({
    previewBufferedRanges: state.previewBufferedRanges.map(snapRange),
    bufferingRange: state.bufferingRange ? snapRange(state.bufferingRange) : null,
  });
}

const EMPTY_FRAME_DIAG: FrameDiagnostics = {
  frameStatus: "none",
  width: 0,
  height: 0,
  rgbaBytes: 0,
  checksum: 0,
  drawCount: 0,
  canvasSize: "0x0",
  lastError: "",
  testPattern: false,
};

const EnginePreviewPanel = forwardRef<VideoPreviewHandle, EnginePreviewPanelProps>(
  function EnginePreviewPanel(
    {
      timelineLayers,
      projectItems,
      mediaInfoByPath,
      compositionName,
      compWidth,
      compHeight,
      selectedLayer,
      compCurrentTime,
      compDuration,
      playbackRate,
      loop,
      seekTime,
      onAddMedia,
      isPlaying,
      onCurrentTimeChange,
      onPlayingChange,
      onPlaybackRateChange,
      onToggleLoop,
      onPreviewBufferStateChange,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sessionPathRef = useRef<string | null>(null);
    const lastEngineSourceSeekRef = useRef<number | null>(null);
    const scrubGenerationRef = useRef(0);
    const seekInProgressRef = useRef(false);
    const seekInFlightCountRef = useRef(0);
    const pendingEngineSeekRef = useRef<{
      sourceTime: number;
      context?: { compTime: number; layerId: string };
    } | null>(null);
    const engineSeekTimerRef = useRef<number | null>(null);
    const lastSeekRequestMsRef = useRef(0);
    const SCRUB_ENGINE_SEEK_DEBOUNCE_MS = 200;

    const trackSeekStart = useCallback(() => {
      seekInFlightCountRef.current += 1;
      seekInProgressRef.current = true;
    }, []);

    const trackSeekEnd = useCallback(() => {
      seekInFlightCountRef.current = Math.max(0, seekInFlightCountRef.current - 1);
      seekInProgressRef.current = seekInFlightCountRef.current > 0;
    }, []);
    const onPreviewBufferStateChangeRef = useRef(onPreviewBufferStateChange);
    const lastPreviewBufferStateKeyRef = useRef("");
    const lastEngineStatePollMsRef = useRef(0);
    const compTimeRef = useRef(compCurrentTime);
    const pendingUserSeekCompRef = useRef<number | null>(null);
    const isPlayingRef = useRef(isPlaying);
    const durationRef = useRef(compDuration);
    const loopRef = useRef(loop);
    const fpsRef = useRef(30);
    const previewLayerRef = useRef<TimelineLayer | null>(null);
    const onCurrentTimeChangeRef = useRef(onCurrentTimeChange);
    const onPlayingChangeRef = useRef(onPlayingChange);
    const lastDrawnSequenceRef = useRef<number | null>(null);
    const lastDrawnTimeRef = useRef<number | null>(null);
    const loggedRendererFrameRef = useRef(false);
    const drawCountRef = useRef(0);
    const pollCountRef = useRef(0);
    const framesReceivedRef = useRef(0);
    const wasPlayingRef = useRef(isPlaying);
    const pendingInitialFrameRef = useRef<PreviewEngineFrameResult | null>(null);
    const skipAutoCompSeekRef = useRef(true);
    const [seekWarning, setSeekWarning] = useState<string | null>(null);
    const [liveCompTime, setLiveCompTime] = useState(compCurrentTime);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [engineStatus, setEngineStatus] = useState<EnginePreviewStatus>("idle");
    const [engineError, setEngineError] = useState<string | null>(null);
    const [sessionReady, setSessionReady] = useState(false);
    const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
    const [frameDiag, setFrameDiag] = useState<FrameDiagnostics>(EMPTY_FRAME_DIAG);
    const [playbackDiag, setPlaybackDiag] = useState({
      engineTimeSec: 0,
      engineIsPlaying: false,
      queueDepth: 0,
      pollCount: 0,
      framesReceived: 0,
    });

    const engineStatusRef = useRef(engineStatus);
    const engineErrorRef = useRef(engineError);
    const sessionReadyRef = useRef(sessionReady);
    const frameDiagRef = useRef(frameDiag);
    engineStatusRef.current = engineStatus;
    engineErrorRef.current = engineError;
    sessionReadyRef.current = sessionReady;
    frameDiagRef.current = frameDiag;

    const previewTarget = useMemo(
      () => resolveEnginePreviewLayer(timelineLayers, selectedLayer, projectItems),
      [projectItems, selectedLayer, timelineLayers]
    );

    const previewLayer = previewTarget?.layer ?? null;
    const originalPath = previewTarget?.originalPath ?? "";

    const {
      audioRef,
      audioStatus,
      audioStatusLabel,
      audioWarning,
      isUserMuted,
      toggleMute,
      pauseAudio,
      seekAudio,
      playAudioAfterVideo,
      correctAudioDrift,
      getAudioDebug,
    } = usePreviewAudio({
      originalPath,
      previewLayer,
      compCurrentTime,
      sessionReady,
    });

    const getAudioDebugRef = useRef(getAudioDebug);
    getAudioDebugRef.current = getAudioDebug;

    previewLayerRef.current = previewLayer;

    const fps =
      (previewLayer && mediaInfoByPath[previewLayer.sourcePath]?.fps) ??
      Object.values(mediaInfoByPath).find((info) => info?.fps)?.fps ??
      30;
    const duration = compDuration || 0;

    const layerVisible =
      Boolean(previewLayer) &&
      isLayerVisibleAtCompTime(previewLayer!, liveCompTime);

    const transform = useMemo(
      () =>
        previewLayer ? getEffectiveLayerTransform(previewLayer, liveCompTime) : undefined,
      [previewLayer, liveCompTime]
    );

    const selectedMedia = previewLayer
      ? mediaInfoByPath[previewLayer.sourcePath]
      : undefined;
    const layerSource = getLayerSourceSize(
      videoSize.width || selectedMedia?.width || 0,
      videoSize.height || selectedMedia?.height || 0,
      previewLayer?.crop,
      previewLayer?.cropEnabled
    );

    const propagatePlaybackTime = useCallback((next: number) => {
      const snapped = snapTimeToFrame(next, fpsRef.current);
      compTimeRef.current = snapped;
      setLiveCompTime(snapped);
      onCurrentTimeChangeRef.current(snapped);
    }, []);

    const drawIpcFrame = useCallback((frame: PreviewEngineFrameResult): boolean => {
      if (!frame.ok || frame.width <= 0 || frame.height <= 0) {
        setFrameDiag((prev) => ({
          ...prev,
          frameStatus: "none",
          lastError: frame.error ?? "frame missing dimensions",
        }));
        return false;
      }
      if (frame.isNew) {
        framesReceivedRef.current += 1;
      }
      const rgba = rgbaFromIpc(frame.rgba);
      const canvas = canvasRef.current;
      if (!rgba) {
        setFrameDiag((prev) => ({
          ...prev,
          frameStatus: "none",
          lastError: "rgba missing after IPC",
        }));
        return false;
      }
      if (!canvas) {
        setFrameDiag((prev) => ({
          ...prev,
          frameStatus: "none",
          lastError: "canvas ref not mounted",
        }));
        return false;
      }

      if (SHOW_ENGINE_DEV_DIAG && !loggedRendererFrameRef.current) {
        loggedRendererFrameRef.current = true;
        logRendererEngineFrame({ width: frame.width, height: frame.height, rgba });
      }

      const checksum = rgbaChecksum(rgba);
      const frameSequence = frame.sequence ?? null;
      const playbackTimeAdvanced =
        isPlayingRef.current &&
        lastDrawnTimeRef.current !== null &&
        Math.abs(frame.timeSec - lastDrawnTimeRef.current) > 0.02;
      const sourceTimeAdvanced =
        lastDrawnTimeRef.current === null ||
        frame.timeSec > lastDrawnTimeRef.current + 0.02;
      const shouldRedraw =
        drawCountRef.current === 0 ||
        frame.isNew === true ||
        (frameSequence !== null && lastDrawnSequenceRef.current !== frameSequence) ||
        playbackTimeAdvanced ||
        (isPlayingRef.current && sourceTimeAdvanced);
      if (!shouldRedraw) {
        setFrameDiag((prev) => ({
          ...prev,
          frameStatus: "ok",
          width: frame.width,
          height: frame.height,
          rgbaBytes: rgba.length,
          checksum,
        }));
        setPlaybackDiag((prev) => ({
          ...prev,
          pollCount: pollCountRef.current,
          framesReceived: framesReceivedRef.current,
          queueDepth: frame.queueDepth ?? prev.queueDepth,
        }));
        return true;
      }

      const drawResult = drawRgbaToCanvas(canvas, frame.width, frame.height, rgba, {
        forceAlpha: true,
      });
      if (!drawResult.ok) {
        setFrameDiag((prev) => ({
          ...prev,
          frameStatus: "none",
          lastError: drawResult.error ?? "canvas draw failed",
        }));
        return false;
      }

      drawCountRef.current += 1;
      lastDrawnTimeRef.current = frame.timeSec;
      if (frameSequence !== null) {
        lastDrawnSequenceRef.current = frameSequence;
      }
      setFrameDiag({
        frameStatus: "ok",
        width: frame.width,
        height: frame.height,
        rgbaBytes: rgba.length,
        checksum,
        drawCount: drawCountRef.current,
        canvasSize: `${drawResult.canvasWidth}x${drawResult.canvasHeight}`,
        lastError: "",
        testPattern: false,
      });
      setPlaybackDiag((prev) => ({
        ...prev,
        pollCount: pollCountRef.current,
        framesReceived: framesReceivedRef.current,
        queueDepth: frame.queueDepth ?? prev.queueDepth,
      }));
      return true;
    }, []);

    const drawPollFrame = useCallback(async (): Promise<boolean> => {
      pollCountRef.current += 1;
      const frame = await window.ffmpegStudio.previewEnginePollFrame();
      setPlaybackDiag((prev) => ({
        ...prev,
        pollCount: pollCountRef.current,
      }));
      return drawIpcFrame(frame);
    }, [drawIpcFrame]);

    const enginePlayAtSourceTime = useCallback(
      async (sourceTime: number): Promise<boolean> => {
        const playResult = await window.ffmpegStudio.previewEnginePlay(sourceTime);
        if (playResult.frame) {
          drawIpcFrame(playResult.frame);
        }
        if (playResult.ok) {
          await playAudioAfterVideo(sourceTime);
          setEngineStatus("playing");
          setEngineError(null);
          return true;
        }
        setSeekWarning(playResult.error ?? playResult.warning ?? "Preview engine play failed");
        return false;
      },
      [drawIpcFrame, playAudioAfterVideo]
    );

    const engineSeekSourceTime = useCallback(
      async (
        sourceTime: number,
        seekContext?: { compTime: number; layerId: string }
      ): Promise<boolean> => {
        if (!sessionReadyRef.current) {
          trackSeekEnd();
          if (seekContext) {
            logTimelineSeekFlow({
              compTime: seekContext.compTime,
              sourceTime,
              layerId: seekContext.layerId,
              seekResultOk: false,
              hasFrame: false,
              drawOk: false,
              note: "session not ready",
            });
          }
          return false;
        }
        if (lastEngineSourceSeekRef.current === sourceTime) {
          trackSeekEnd();
          const drawOk = drawCountRef.current > 0;
          if (seekContext) {
            logTimelineSeekFlow({
              compTime: seekContext.compTime,
              sourceTime,
              layerId: seekContext.layerId,
              seekResultOk: true,
              hasFrame: drawOk,
              drawOk,
              note: "deduped source time",
            });
          }
          return drawOk;
        }

        const generation = scrubGenerationRef.current + 1;
        scrubGenerationRef.current = generation;
        const wasPlaying = isPlayingRef.current;
        setEngineStatus("seeking");

        try {
          const seekResult = await window.ffmpegStudio.previewEngineSeek(sourceTime);
          if (scrubGenerationRef.current !== generation) {
            return false;
          }

          const hasFrame = Boolean(seekResult.frame);
          let drawOk = false;
          if (seekResult.frame) {
            lastEngineSourceSeekRef.current = sourceTime;
            lastDrawnSequenceRef.current = null;
            lastDrawnTimeRef.current = null;
            drawOk = drawIpcFrame(seekResult.frame);
            setSeekWarning(seekResult.warning ?? null);
            setEngineError(null);
          } else {
            setSeekWarning(seekResult.warning ?? seekResult.error ?? "Seek returned no frame");
          }

          if (scrubGenerationRef.current === generation) {
            if (wasPlaying && isPlayingRef.current) {
              await enginePlayAtSourceTime(sourceTime);
            } else if (!isPlayingRef.current) {
              seekAudio(sourceTime, false);
              setEngineStatus("paused");
            } else {
              setEngineStatus("buffering");
            }
          }

          if (seekContext) {
            logTimelineSeekFlow({
              compTime: seekContext.compTime,
              sourceTime,
              layerId: seekContext.layerId,
              seekResultOk: seekResult.ok,
              hasFrame,
              drawOk,
              note: seekResult.warning,
            });
          }

          if (scrubGenerationRef.current === generation && seekContext) {
            pendingUserSeekCompRef.current = null;
          }

          if (hasFrame) {
            return drawOk;
          }

          return false;
        } catch (error) {
          if (scrubGenerationRef.current === generation) {
            if (wasPlaying && isPlayingRef.current) {
              try {
                await enginePlayAtSourceTime(sourceTime);
              } catch {
                setEngineStatus("playing");
              }
            } else {
              setEngineStatus("paused");
            }
            setSeekWarning(error instanceof Error ? error.message : "Preview engine seek failed");
          }
          if (seekContext) {
            logTimelineSeekFlow({
              compTime: seekContext.compTime,
              sourceTime,
              layerId: seekContext.layerId,
              seekResultOk: false,
              hasFrame: false,
              drawOk: false,
              note: error instanceof Error ? error.message : String(error),
            });
          }
          return false;
        } finally {
          trackSeekEnd();
        }
      },
      [drawIpcFrame, enginePlayAtSourceTime, seekAudio, sessionReady, trackSeekEnd, trackSeekStart]
    );

    const flushPendingEngineSeek = useCallback(async () => {
      const pending = pendingEngineSeekRef.current;
      if (!pending) {
        return;
      }
      pendingEngineSeekRef.current = null;
      if (engineSeekTimerRef.current !== null) {
        window.clearTimeout(engineSeekTimerRef.current);
        engineSeekTimerRef.current = null;
      }
      await engineSeekSourceTime(pending.sourceTime, pending.context);
    }, [engineSeekSourceTime]);

    const scheduleEngineSeek = useCallback(
      (
        sourceTime: number,
        context?: { compTime: number; layerId: string }
      ) => {
        pendingEngineSeekRef.current = { sourceTime, context };
        const now = performance.now();
        const rapid = now - lastSeekRequestMsRef.current < 250;
        lastSeekRequestMsRef.current = now;

        if (engineSeekTimerRef.current !== null) {
          window.clearTimeout(engineSeekTimerRef.current);
          engineSeekTimerRef.current = null;
        }

        const delay = rapid ? SCRUB_ENGINE_SEEK_DEBOUNCE_MS : 0;
        if (delay === 0) {
          void flushPendingEngineSeek();
          return;
        }
        engineSeekTimerRef.current = window.setTimeout(() => {
          void flushPendingEngineSeek();
        }, delay);
      },
      [flushPendingEngineSeek]
    );

    const seekToCompTime = useCallback(
      (time: number) => {
        const maxTime = durationRef.current > 0 ? durationRef.current : time;
        const snapped = snapTimeToFrame(Math.max(0, Math.min(maxTime, time)), fpsRef.current);

        pendingUserSeekCompRef.current = snapped;
        trackSeekStart();
        propagatePlaybackTime(snapped);

        const layer = previewLayerRef.current;
        if (!sessionReadyRef.current || !layer) {
          pendingUserSeekCompRef.current = null;
          trackSeekEnd();
          return;
        }

        const sourceTime = getLayerSourceTime(layer, snapped);
        if (sourceTime === null) {
          pendingUserSeekCompRef.current = null;
          trackSeekEnd();
          return;
        }

        if (LOG_TIMELINE_SEEK_DEBUG) {
          console.log("[TIMELINE_SEEK_DIRECT]", { compTime: snapped, sourceTime });
        }

        lastEngineSourceSeekRef.current = null;
        scheduleEngineSeek(sourceTime, { compTime: snapped, layerId: layer.id });
      },
      [propagatePlaybackTime, scheduleEngineSeek, trackSeekEnd, trackSeekStart]
    );

    const togglePlay = useCallback(() => {
      const nextPlaying = !isPlayingRef.current;
      isPlayingRef.current = nextPlaying;
      onPlayingChangeRef.current(nextPlaying);
      if (!nextPlaying && sessionReadyRef.current) {
        void (async () => {
          await window.ffmpegStudio.previewEnginePause();
          pauseAudio();
          setEngineStatus("paused");
          setEngineError(null);
        })();
      }
    }, [pauseAudio]);

    const armUserSeek = useCallback((time: number) => {
      const maxTime = durationRef.current > 0 ? durationRef.current : time;
      const snapped = snapTimeToFrame(Math.max(0, Math.min(maxTime, time)), fpsRef.current);
      pendingUserSeekCompRef.current = snapped;
      compTimeRef.current = snapped;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        togglePlay,
        armUserSeek,
        seekToCompTime,
        stepFrame: (delta: number) => {
          seekToCompTime(
            snapTimeToFrame(
              Math.max(0, Math.min(duration, liveCompTime + delta * frameDuration(fps))),
              fps
            )
          );
        },
      }),
      [armUserSeek, duration, fps, liveCompTime, seekToCompTime, togglePlay]
    );

    useEffect(() => {
      if (!shouldRegisterPreviewE2eDebug()) {
        return;
      }
      registerPreviewE2eDebug({
        getCanvasChecksum: () => canvasChecksum(canvasRef.current),
        getEngineState: () => window.ffmpegStudio.previewEngineGetState(),
        getDrawCount: () => drawCountRef.current,
        getPollCount: () => pollCountRef.current,
        getLastDrawnTimeSec: () => lastDrawnTimeRef.current,
        getLastDrawnChecksum: () => frameDiagRef.current.checksum,
        getPreviewRuntimeDebug: async () => {
          const state = await window.ffmpegStudio.previewEngineGetState();
          const lastDrawnTimeSec = lastDrawnTimeRef.current;
          const enginePlayheadSec = state?.playheadSec ?? 0;
          return {
            drawCount: drawCountRef.current,
            lastDrawnTimeSec,
            lastChecksum: frameDiagRef.current.checksum,
            pollCount: pollCountRef.current,
            enginePlayheadSec,
            engineIsPlaying: state?.isPlaying === true,
            enginePhase: state?.enginePhase ?? "unknown",
            queueDepth: state?.queueDepth ?? 0,
            queueTimeRangeMin: state?.queueMinTimeSec ?? null,
            queueTimeRangeMax: state?.queueMaxTimeSec ?? null,
            displayDrift:
              lastDrawnTimeSec !== null ? enginePlayheadSec - lastDrawnTimeSec : null,
            decodedFrames: state?.decodedFrames ?? 0,
          };
        },
        getLastError: () => frameDiagRef.current.lastError,
        getSessionReady: () => sessionReadyRef.current,
        getEngineStatus: () => engineStatusRef.current,
        getVisibleError: () =>
          engineStatusRef.current === "engine error"
            ? engineErrorRef.current ?? "engine error"
            : null,
        getAudioDebug: () => getAudioDebugRef.current(),
      });
      return () => unregisterPreviewE2eDebug();
    }, []);

    useEffect(() => {
      compTimeRef.current = compCurrentTime;
      if (!isPlaying) {
        setLiveCompTime(compCurrentTime);
      }
    }, [compCurrentTime, isPlaying]);

    useEffect(() => {
      isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
      durationRef.current = duration;
    }, [duration]);

    useEffect(() => {
      loopRef.current = loop;
    }, [loop]);

    useEffect(() => {
      fpsRef.current = fps;
    }, [fps]);

    useEffect(() => {
      onCurrentTimeChangeRef.current = onCurrentTimeChange;
    }, [onCurrentTimeChange]);

    useEffect(() => {
      onPlayingChangeRef.current = onPlayingChange;
    }, [onPlayingChange]);

    useEffect(() => {
      onPreviewBufferStateChangeRef.current = onPreviewBufferStateChange;
    }, [onPreviewBufferStateChange]);

    useLayoutEffect(() => {
      if (seekTime === null || Number.isNaN(seekTime)) {
        return;
      }
      logEngineSeekProp(seekTime, sessionReadyRef.current);
      if (!sessionReadyRef.current) {
        return;
      }
      seekToCompTime(seekTime);
    }, [seekTime, seekToCompTime, sessionReady]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      observer.observe(container);
      return () => observer.disconnect();
    }, [timelineLayers.length]);

    useEffect(() => {
      let cancelled = false;

      async function openSession(): Promise<void> {
        if (!originalPath) {
          setSessionReady(false);
          setEngineStatus("idle");
          setEngineError(null);
          sessionPathRef.current = null;
          lastEngineSourceSeekRef.current = null;
          lastDrawnSequenceRef.current = null;
          return;
        }

        if (sessionPathRef.current === originalPath) {
          return;
        }

        setEngineStatus("loading engine");
        setEngineError(null);
        setSessionReady(false);
        pendingInitialFrameRef.current = null;
        skipAutoCompSeekRef.current = true;
        setSeekWarning(null);
        lastEngineSourceSeekRef.current = null;
        lastDrawnSequenceRef.current = null;
        loggedRendererFrameRef.current = false;
        drawCountRef.current = 0;
        pollCountRef.current = 0;
        framesReceivedRef.current = 0;
        setFrameDiag(EMPTY_FRAME_DIAG);
        setPlaybackDiag({
          engineTimeSec: 0,
          engineIsPlaying: false,
          queueDepth: 0,
          pollCount: 0,
          framesReceived: 0,
        });

        try {
          await window.ffmpegStudio.previewEngineClose();
          setEngineStatus("opening file");
          const openResult = await window.ffmpegStudio.previewEngineOpen(originalPath);
          if (cancelled) {
            return;
          }
          if (!openResult.ok) {
            setEngineStatus("engine error");
            setEngineError(openResult.error ?? "Preview engine open failed");
            return;
          }
          if (!openResult.initialFrame?.ok) {
            setEngineStatus("engine error");
            setEngineError("Engine error: no initial frame decoded");
            return;
          }
          sessionPathRef.current = originalPath;
          if (openResult.metadata) {
            setVideoSize({
              width: openResult.metadata.width,
              height: openResult.metadata.height,
            });
          }
          pendingInitialFrameRef.current = openResult.initialFrame;
          setSessionReady(true);
          setEngineStatus("paused");
        } catch (error) {
          if (!cancelled) {
            setEngineStatus("engine error");
            setEngineError(error instanceof Error ? error.message : "Preview engine crashed");
          }
        }
      }

      void openSession();

      return () => {
        cancelled = true;
      };
    }, [originalPath]);

    useEffect(() => {
      if (!sessionReady) {
        return;
      }

      let cancelled = false;

      void (async () => {
        const queuedFrame = pendingInitialFrameRef.current;
        pendingInitialFrameRef.current = null;

        let frame = queuedFrame;
        if (!frame?.ok || !frame.rgba) {
          if (frame?.ok && !frame.rgba) {
            console.warn("[PREVIEW] openResult.initialFrame missing rgba; falling back to pollFrame");
          } else if (!frame) {
            console.warn("[PREVIEW] openResult.initialFrame missing; falling back to pollFrame");
          }
          frame = await window.ffmpegStudio.previewEnginePollFrame();
        }

        if (cancelled) {
          return;
        }

        if (!frame.ok) {
          setEngineStatus("engine error");
          setEngineError(frame.error ?? "Engine error: no initial frame decoded");
          return;
        }

        if (!drawIpcFrame(frame)) {
          setEngineStatus("engine error");
          setEngineError("Engine error: no initial frame decoded");
        } else {
          skipAutoCompSeekRef.current = true;
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [drawIpcFrame, sessionReady]);

    useEffect(() => {
      return () => {
        sessionPathRef.current = null;
        void window.ffmpegStudio.previewEngineClose();
      };
    }, []);

    useEffect(() => {
      if (!sessionReady || !previewLayer || isPlaying) {
        return;
      }
      if (skipAutoCompSeekRef.current) {
        return;
      }
      const sourceTime = getLayerSourceTime(previewLayer, compCurrentTime);
      if (sourceTime === null) {
        return;
      }
      void engineSeekSourceTime(sourceTime);
    }, [compCurrentTime, engineSeekSourceTime, isPlaying, previewLayer, sessionReady]);

    useEffect(() => {
      if (!sessionReady || !previewLayer) {
        return;
      }

      if (isPlaying && !wasPlayingRef.current) {
        void (async () => {
          const layer = previewLayerRef.current;
          const sourceTime = layer
            ? getLayerSourceTime(layer, compTimeRef.current)
            : null;
          if (sourceTime === null) {
            await window.ffmpegStudio.previewEnginePlay();
            setEngineStatus("playing");
            setEngineError(null);
            return;
          }
          await enginePlayAtSourceTime(sourceTime);
        })();
      } else if (!isPlaying && wasPlayingRef.current) {
        void (async () => {
          await window.ffmpegStudio.previewEnginePause();
          pauseAudio();
          setEngineStatus("paused");
          setEngineError(null);
        })();
      }

      wasPlayingRef.current = isPlaying;
    }, [enginePlayAtSourceTime, isPlaying, pauseAudio, previewLayer, sessionReady]);

    useEffect(() => {
      if (!sessionReady) {
        return;
      }

      let active = true;
      let rafId = 0;

      const tick = async () => {
        if (!active) {
          return;
        }

        try {
          const layer = previewLayerRef.current;

          if (isPlayingRef.current && !seekInProgressRef.current) {
            await drawPollFrame();
          }

          const nowMs = performance.now();
          const shouldPollEngineState =
            Boolean(layer) &&
            (!isPlayingRef.current || nowMs - lastEngineStatePollMsRef.current >= 250);
          const state = shouldPollEngineState
            ? await window.ffmpegStudio.previewEngineGetState()
            : null;
          if (state?.ok) {
            lastEngineStatePollMsRef.current = nowMs;
          }

          if (layer && state?.ok) {
            const enginePhase = state.enginePhase;
            if (
              enginePhase === "seeking" ||
              enginePhase === "buffering" ||
              enginePhase === "playing" ||
              enginePhase === "paused"
            ) {
              if (enginePhase === "seeking" && !seekInProgressRef.current) {
                setEngineStatus("seeking");
              } else if (enginePhase === "buffering") {
                setEngineStatus("buffering");
              } else if (enginePhase === "playing" && isPlayingRef.current) {
                setEngineStatus("playing");
              } else if (enginePhase === "paused" && !isPlayingRef.current) {
                setEngineStatus("paused");
              }
            }

            const bufferedRanges = state.previewBufferedRanges ?? [];
            const mappedBufferState = mapEngineBufferStateToComp(
              layer,
              bufferedRanges,
              state.bufferingRange
            );
            const bufferStateKey = previewBufferStateKey(mappedBufferState);
            if (bufferStateKey !== lastPreviewBufferStateKeyRef.current) {
              lastPreviewBufferStateKeyRef.current = bufferStateKey;
              onPreviewBufferStateChangeRef.current?.(mappedBufferState);
            }

            setPlaybackDiag((prev) => ({
              ...prev,
              engineTimeSec: state.playheadSec,
              engineIsPlaying: state.isPlaying,
              queueDepth: state.queueDepth ?? prev.queueDepth,
              pollCount: pollCountRef.current,
              framesReceived: framesReceivedRef.current,
            }));

            correctAudioDrift(state.playheadSec, isPlayingRef.current);

            if (isPlayingRef.current && !seekInProgressRef.current) {
              const pendingUserSeek = pendingUserSeekCompRef.current;
              if (pendingUserSeek !== null) {
                const engineCompTime = sourceTimeToCompTime(layer, state.playheadSec);
                if (Math.abs(engineCompTime - pendingUserSeek) <= 0.75) {
                  pendingUserSeekCompRef.current = null;
                  propagatePlaybackTime(engineCompTime);
                } else {
                  propagatePlaybackTime(pendingUserSeek);
                }
              } else {
                let compTime = sourceTimeToCompTime(layer, state.playheadSec);
                const dur = durationRef.current;
                if (dur > 0 && compTime >= dur) {
                  if (loopRef.current) {
                    compTime = 0;
                    const restartSource = getLayerSourceTime(layer, 0) ?? 0;
                    lastEngineSourceSeekRef.current = null;
                    await engineSeekSourceTime(restartSource);
                    await enginePlayAtSourceTime(restartSource);
                  } else {
                    propagatePlaybackTime(dur);
                    onPlayingChangeRef.current(false);
                    setEngineStatus("paused");
                    return;
                  }
                } else {
                  propagatePlaybackTime(compTime);
                }
              }
            }
          }
        } catch (error) {
          setEngineStatus("engine error");
          setEngineError(error instanceof Error ? error.message : "Preview engine poll failed");
        }

        if (active) {
          rafId = requestAnimationFrame(() => {
            void tick();
          });
        }
      };

      rafId = requestAnimationFrame(() => {
        void tick();
      });

      return () => {
        active = false;
        cancelAnimationFrame(rafId);
      };
    }, [
      correctAudioDrift,
      drawPollFrame,
      enginePlayAtSourceTime,
      engineSeekSourceTime,
      propagatePlaybackTime,
      sessionReady,
    ]);

    const stageW = Math.max(containerSize.width, 320);
    const stageH = Math.max(containerSize.height, 200);
    const layout = getCompCanvasLayout(stageW, stageH, compWidth, compHeight);

    const sourceW = layerSource.width || videoSize.width || 1920;
    const sourceH = layerSource.height || videoSize.height || 1080;
    const displayGeometry =
      transform && sourceW > 0
        ? getLayerDisplayGeometry(
            transform,
            sourceW,
            sourceH,
            previewLayer?.crop,
            previewLayer?.cropEnabled
          )
        : null;

    const compactMeta = [
      `${compWidth}x${compHeight}`,
      `${timelineLayers.length} layer${timelineLayers.length === 1 ? "" : "s"}`,
      formatFps(fps),
      formatDuration(duration),
    ]
      .filter(Boolean)
      .join(" · ");

    const statusLabel =
      engineStatus === "engine error"
        ? `engine error: ${engineError ?? "unknown"}`
        : engineStatus === "seeking"
          ? "seeking…"
          : engineStatus === "buffering"
            ? "buffering…"
            : engineStatus;

    if (timelineLayers.length === 0) {
      return (
        <section className="video-preview editor-preview-panel engine-preview-panel">
          <div className="workspace-header">
            <h2 className="workspace-header-title">Preview</h2>
          </div>
          <div className="video-preview-body">
            <div className="workspace-empty preview-state-empty">
              <div className="workspace-empty-icon">▶</div>
              <p className="workspace-empty-text">No composition layers</p>
              <p className="workspace-empty-hint">
                Import footage in Project Panel or drag a video anywhere
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={onAddMedia}>
                Import Media
              </button>
            </div>
          </div>
        </section>
      );
    }

    if (!previewTarget) {
      return (
        <section className="video-preview editor-preview-panel engine-preview-panel">
          <div className="workspace-header">
            <h2 className="workspace-header-title">Preview</h2>
          </div>
          <div className="video-preview-body">
            <div className="workspace-empty preview-state-empty">
              <p className="workspace-empty-text">No footage layer for engine preview</p>
              <p className="workspace-empty-hint">Add a video layer to the composition</p>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="video-preview editor-preview-panel engine-preview-panel">
        <div className="workspace-header">
          <div>
            <h2 className="workspace-header-title">Preview</h2>
            {compositionName && (
              <p className="video-composition-label">Composition: {compositionName}</p>
            )}
          </div>
          <span
            className={`preview-state-badge state-${isPlaying ? "playing" : "ready"} engine-preview-status`}
          >
            {statusLabel}
          </span>
        </div>

        {(audioWarning || audioStatus === "unavailable") && (
          <p className="video-preview-tool-status engine-preview-audio-status">
            {audioStatusLabel}
            {audioWarning && audioWarning !== "audio unavailable"
              ? ` (${audioWarning})`
              : ""}
          </p>
        )}

        {SHOW_ENGINE_DEV_DIAG && (
          <details className="engine-preview-dev-diag">
            <summary className="video-preview-tool-status">Engine dev diagnostics</summary>
            <p className="engine-preview-audio-diag video-preview-tool-status">
              audio: {audioStatusLabel}
              {audioWarning ? ` · warning: ${audioWarning}` : ""}
            </p>
            <p className="engine-preview-frame-diag video-preview-tool-status">
              engine frame: {frameDiag.frameStatus} · w: {frameDiag.width} · h: {frameDiag.height}{" "}
              · rgba bytes: {frameDiag.rgbaBytes} · checksum: {frameDiag.checksum} · draw count:{" "}
              {frameDiag.drawCount} · canvas: {frameDiag.canvasSize} · last error:{" "}
              {frameDiag.lastError || "none"}
            </p>
            <p className="engine-preview-playback-diag video-preview-tool-status">
              engine status: {engineStatus} · engine time: {playbackDiag.engineTimeSec.toFixed(3)}s
              · ui isPlaying: {String(isPlaying)} · poll count: {playbackDiag.pollCount} · frames
              received: {playbackDiag.framesReceived} · draw count: {frameDiag.drawCount} · queue
              depth: {playbackDiag.queueDepth}
              {seekWarning ? ` · seek warning: ${seekWarning}` : ""}
            </p>
          </details>
        )}

        <div className="video-preview-body">
          <audio
            ref={audioRef}
            className="engine-preview-audio"
            data-testid="engine-preview-audio"
            preload="auto"
          />
          <div ref={containerRef} className="video-stage">
            {sessionReady && (
              <div
                className="comp-canvas engine-preview-canvas-host"
                style={{
                  left: layout.offsetX,
                  top: layout.offsetY,
                  width: layout.renderWidth,
                  height: layout.renderHeight,
                  pointerEvents: "none",
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="engine-preview-canvas"
                  data-testid="engine-preview-canvas"
                  style={
                    displayGeometry && layerVisible && transform
                      ? {
                          position: "absolute",
                          left: displayGeometry.fullLeft * layout.scale,
                          top: displayGeometry.fullTop * layout.scale,
                          width: displayGeometry.fullWidth * layout.scale,
                          height: displayGeometry.fullHeight * layout.scale,
                          opacity: (transform.opacity ?? 100) / 100,
                          transform: `rotate(${transform.rotation}deg)`,
                          transformOrigin: `${transform.anchorX * 100}% ${transform.anchorY * 100}%`,
                          display: "block",
                        }
                      : {
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: "100%",
                          height: "100%",
                          display: "block",
                        }
                  }
                />
              </div>
            )}

            {!sessionReady && (
              <div className="engine-preview-placeholder">
                {engineStatus === "engine error"
                  ? statusLabel
                  : engineStatus === "decoding frame"
                    ? "Decoding frame…"
                    : engineStatus === "opening file"
                      ? "Opening…"
                      : engineStatus === "loading engine"
                        ? "Loading engine…"
                        : statusLabel}
              </div>
            )}
          </div>

          {compactMeta && <p className="video-compact-meta">{compactMeta}</p>}

          <div className="engine-preview-playback-row">
            <button
              type="button"
              className={`playback-btn engine-preview-audio-mute ${isUserMuted ? "active" : ""}`}
              data-testid="preview-audio-mute-button"
              onClick={toggleMute}
              disabled={!sessionReady}
              title={isUserMuted ? "Unmute preview audio" : "Mute preview audio"}
            >
              {isUserMuted ? "🔇" : "🔊"}
            </button>
            <PlaybackControls
              disabled={!sessionReady}
              isPlaying={isPlaying}
              currentTime={liveCompTime}
              duration={duration}
              playbackRate={playbackRate}
              loop={loop}
              previewSyncMode="composition-clock"
              cacheStatus="none"
              onTogglePlay={togglePlay}
            onGoToStart={() => seekToCompTime(0)}
            onGoToEnd={() => seekToCompTime(duration)}
            onPrevFrame={() =>
              seekToCompTime(
                snapTimeToFrame(Math.max(0, liveCompTime - frameDuration(fps)), fps)
              )
            }
            onNextFrame={() =>
              seekToCompTime(
                snapTimeToFrame(Math.min(duration, liveCompTime + frameDuration(fps)), fps)
              )
            }
            onPlaybackRateChange={onPlaybackRateChange}
            onToggleLoop={onToggleLoop}
            />
          </div>
        </div>
      </section>
    );
  }
);

export default EnginePreviewPanel;
