import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FFMPEG_EFFECT_CATALOG,
  type FfmpegEffectDefinition,
} from "../../effects/ffmpegEffectCatalog";
import type { FfmpegResolveResult, FfmpegFilterInfo } from "../../shared/types";

export type StartupStage =
  | "booting"
  | "checking-ffmpeg"
  | "loading-filters"
  | "preparing-workspace"
  | "ready"
  | "error";

const STAGE_LABELS: Record<Exclude<StartupStage, "ready" | "error">, string> = {
  booting: "Initializing UI…",
  "checking-ffmpeg": "Checking FFmpeg…",
  "loading-filters": "Loading FFmpeg filters…",
  "preparing-workspace": "Preparing workspace…",
};

const SLOW_STARTUP_MS = 8000;

export type AppStartupState = {
  stage: StartupStage;
  stageLabel: string;
  isVisible: boolean;
  isSlow: boolean;
  error: string | null;
  canContinueAnyway: boolean;
  ffmpegStatus: FfmpegResolveResult | null;
  filters: FfmpegFilterInfo[];
  availableNames: Set<string>;
  filtersError: string | null;
  isEffectAvailable: (def: FfmpegEffectDefinition) => boolean;
  retry: () => void;
  continueAnyway: () => void;
};

export function useAppStartup(): AppStartupState {
  const [stage, setStage] = useState<StartupStage>("booting");
  const [error, setError] = useState<string | null>(null);
  const [forcedReady, setForcedReady] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegResolveResult | null>(null);
  const [filters, setFilters] = useState<FfmpegFilterInfo[]>([]);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [isSlow, setIsSlow] = useState(false);
  const runIdRef = useRef(0);

  const runStartup = useCallback(async () => {
    const runId = ++runIdRef.current;
    setForcedReady(false);
    setError(null);
    setFiltersError(null);
    setIsSlow(false);
    setStage("booting");

    const isCurrent = () => runIdRef.current === runId;

    await new Promise((resolve) => window.setTimeout(resolve, 120));
    if (!isCurrent()) {
      return;
    }

    setStage("checking-ffmpeg");
    let resolved: FfmpegResolveResult;
    try {
      resolved = await window.ffmpegStudio.resolveFfmpeg();
      if (!isCurrent()) {
        return;
      }
      setFfmpegStatus(resolved);
    } catch (err) {
      if (!isCurrent()) {
        return;
      }
      setStage("error");
      setError(err instanceof Error ? err.message : "Failed to check FFmpeg");
      return;
    }

    if (!resolved.ok) {
      setStage("error");
      setError(resolved.error ?? "FFmpeg not found. Open Settings to configure the path.");
      return;
    }

    setStage("loading-filters");
    try {
      const list = await window.ffmpegStudio.listFfmpegFilters();
      if (!isCurrent()) {
        return;
      }
      setFilters(list);
    } catch (err) {
      if (!isCurrent()) {
        return;
      }
      const message =
        err instanceof Error ? err.message : "Failed to load FFmpeg filters";
      setFilters([]);
      setFiltersError(message);
      setStage("error");
      setError(message);
      return;
    }

    setStage("preparing-workspace");
    await new Promise((resolve) => window.setTimeout(resolve, 280));
    if (!isCurrent()) {
      return;
    }

    setStage("ready");
  }, []);

  useEffect(() => {
    void runStartup();
  }, [runStartup]);

  useEffect(() => {
    if (stage === "ready" || stage === "error") {
      setIsSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setIsSlow(true), SLOW_STARTUP_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const availableNames = useMemo(
    () => new Set(filters.map((entry) => entry.name)),
    [filters]
  );

  const isEffectAvailable = useCallback(
    (def: FfmpegEffectDefinition) =>
      def.ffmpegFilters.every((name) => availableNames.has(name)),
    [availableNames]
  );

  const continueAnyway = useCallback(() => {
    setForcedReady(true);
    setStage("ready");
  }, []);

  const effectiveStage = forcedReady ? "ready" : stage;
  const stageLabel =
    effectiveStage === "error"
      ? "Startup failed"
      : effectiveStage === "ready"
        ? "Ready"
        : STAGE_LABELS[effectiveStage];

  return {
    stage: effectiveStage,
    stageLabel,
    isVisible: effectiveStage !== "ready",
    isSlow: isSlow && effectiveStage !== "ready",
    error,
    canContinueAnyway: stage === "error",
    ffmpegStatus,
    filters,
    availableNames,
    filtersError,
    isEffectAvailable,
    retry: runStartup,
    continueAnyway,
  };
}

export { FFMPEG_EFFECT_CATALOG };
