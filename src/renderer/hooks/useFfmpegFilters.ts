import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FFMPEG_EFFECT_CATALOG,
  getCatalogEffectById,
  type FfmpegEffectDefinition,
} from "../../effects/ffmpegEffectCatalog";
import type { FfmpegFilterInfo } from "../../shared/types";

export type FfmpegFilterAvailability = {
  filters: FfmpegFilterInfo[];
  availableNames: Set<string>;
  loading: boolean;
  error: string | null;
  isEffectAvailable: (def: FfmpegEffectDefinition) => boolean;
  refresh: () => Promise<void>;
};

export function useFfmpegFilters(enabled = true): FfmpegFilterAvailability {
  const [filters, setFilters] = useState<FfmpegFilterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await window.ffmpegStudio.listFfmpegFilters();
      setFilters(list);
    } catch (err) {
      setFilters([]);
      setError(err instanceof Error ? err.message : "Failed to load FFmpeg filters");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const availableNames = useMemo(
    () => new Set(filters.map((entry) => entry.name)),
    [filters]
  );

  const isEffectAvailable = useCallback(
    (def: FfmpegEffectDefinition) =>
      def.ffmpegFilters.every((name) => availableNames.has(name)),
    [availableNames]
  );

  return {
    filters,
    availableNames,
    loading,
    error,
    isEffectAvailable,
    refresh,
  };
}

export function useCatalogFilterAvailability(
  catalogId: string,
  availableNames: Set<string>
): boolean {
  return useMemo(() => {
    const def = getCatalogEffectById(catalogId);
    if (!def) {
      return false;
    }
    return def.ffmpegFilters.every((name) => availableNames.has(name));
  }, [availableNames, catalogId]);
}

export { FFMPEG_EFFECT_CATALOG };
