import type { JobKind } from "../shared/types";

export type FilterRecipeAction =
  | {
      type: "add-effect";
      effectId: string;
      params?: Record<string, number | string | boolean>;
    }
  | {
      type: "set-composition";
      width?: number;
      height?: number;
      fps?: number;
    }
  | {
      type: "set-export";
      format?: string;
      codec?: string;
      crf?: number;
      preset?: string;
      audioBitrate?: string;
      maxOutputWidth?: number;
    }
  | {
      type: "set-layer-fill";
    }
  | {
      type: "create-task";
      jobKind: Extract<JobKind, "proxy" | "preview-cache" | "analysis">;
    };

export type FilterRecipeTarget = "selected-layer" | "composition" | "export";

export type FilterRecipe = {
  id: string;
  title: string;
  category: string;
  description: string;
  difficulty: "simple" | "advanced";
  target: FilterRecipeTarget;
  requiredFilters: string[];
  optionalFilters?: string[];
  actions: FilterRecipeAction[];
  warnings?: string[];
};

export const FILTER_RECIPE_CATEGORIES = [
  "Stabilization",
  "Cleanup",
  "Audio",
  "Social Media",
  "Compression",
  "Export",
] as const;

export type FilterRecipeCategory = (typeof FILTER_RECIPE_CATEGORIES)[number];

export const FILTER_RECIPES: FilterRecipe[] = [
  {
    id: "stabilize-shaky-video",
    title: "Stabilize shaky video",
    category: "Stabilization",
    description: "Uses VidStab if available, otherwise Simple Deshake.",
    difficulty: "advanced",
    target: "selected-layer",
    requiredFilters: ["vidstabdetect", "vidstabtransform"],
    optionalFilters: ["deshake"],
    actions: [
      { type: "add-effect", effectId: "vidstab" },
      { type: "create-task", jobKind: "analysis" },
    ],
    warnings: ["Stabilization is render-only and may not match live preview."],
  },
  {
    id: "quick-deshake",
    title: "Quick Deshake",
    category: "Stabilization",
    description: "Fast single-pass stabilization with adjustable strength.",
    difficulty: "simple",
    target: "selected-layer",
    requiredFilters: ["deshake"],
    actions: [{ type: "add-effect", effectId: "deshake", params: { strength: "medium" } }],
    warnings: ["Render-only — preview may not show stabilization."],
  },
  {
    id: "clean-noisy-low-light",
    title: "Clean noisy low-light video",
    category: "Cleanup",
    description: "Reduce noise in dark or grainy footage using hqdn3d denoise.",
    difficulty: "simple",
    target: "selected-layer",
    requiredFilters: ["hqdn3d"],
    optionalFilters: ["nlmeans"],
    actions: [
      {
        type: "add-effect",
        effectId: "hqdn3d",
        params: { strength: 4 },
      },
    ],
    warnings: ["Strong denoise may soften fine detail."],
  },
  {
    id: "strong-denoise",
    title: "Strong denoise (advanced)",
    category: "Cleanup",
    description: "Heavy noise reduction using nlmeans when available.",
    difficulty: "advanced",
    target: "selected-layer",
    requiredFilters: ["nlmeans"],
    actions: [{ type: "add-effect", effectId: "nlmeans", params: { strength: 10 } }],
    warnings: ["nlmeans is slow and render-only."],
  },
  {
    id: "make-video-sharper",
    title: "Make video sharper",
    category: "Cleanup",
    description: "Apply unsharp mask to enhance edge detail.",
    difficulty: "simple",
    target: "selected-layer",
    requiredFilters: ["unsharp"],
    actions: [{ type: "add-effect", effectId: "unsharp", params: { amount: 0.8 } }],
    warnings: ["Sharpening can increase visible noise."],
  },
  {
    id: "remove-flicker",
    title: "Remove flicker",
    category: "Cleanup",
    description: "Reduce temporal brightness flicker in timelapse or LED footage.",
    difficulty: "simple",
    target: "selected-layer",
    requiredFilters: ["deflicker"],
    actions: [{ type: "add-effect", effectId: "deflicker" }],
    warnings: ["Render-only — preview may not show deflicker."],
  },
  {
    id: "normalize-voice-audio",
    title: "Normalize voice audio",
    category: "Audio",
    description: "EBU R128 loudness normalization for consistent voice levels.",
    difficulty: "simple",
    target: "selected-layer",
    requiredFilters: ["loudnorm"],
    optionalFilters: ["volume"],
    actions: [{ type: "add-effect", effectId: "loudnorm", params: { integrated: -16 } }],
    warnings: ["Loudnorm is render-only and may require analysis for best results."],
  },
  {
    id: "clean-voice-audio",
    title: "Clean voice audio",
    category: "Audio",
    description: "High-pass, low-pass, compression, and loudness normalize for voice.",
    difficulty: "advanced",
    target: "selected-layer",
    requiredFilters: ["highpass", "lowpass", "acompressor"],
    optionalFilters: ["loudnorm"],
    actions: [
      { type: "add-effect", effectId: "highpass", params: { frequency: 80 } },
      { type: "add-effect", effectId: "lowpass", params: { frequency: 12000 } },
      { type: "add-effect", effectId: "acompressor" },
      { type: "add-effect", effectId: "loudnorm", params: { integrated: -16 } },
    ],
    warnings: ["Audio filters are render-only in live preview."],
  },
  {
    id: "prepare-youtube-shorts",
    title: "Prepare for YouTube Shorts",
    category: "Social Media",
    description: "Vertical 1080×1920 composition, fill frame, and web-ready export.",
    difficulty: "simple",
    target: "composition",
    requiredFilters: [],
    actions: [
      { type: "set-composition", width: 1080, height: 1920 },
      { type: "set-layer-fill" },
      {
        type: "set-export",
        format: "mp4",
        codec: "h264",
        crf: 23,
        preset: "medium",
        audioBitrate: "192k",
      },
      { type: "create-task", jobKind: "preview-cache" },
    ],
    warnings: ["Select a layer before applying. Preview cache may take a few minutes."],
  },
  {
    id: "square-social-video",
    title: "Square social video",
    category: "Social Media",
    description: "Square 1080×1080 composition with fill and H.264/AAC export.",
    difficulty: "simple",
    target: "composition",
    requiredFilters: [],
    actions: [
      { type: "set-composition", width: 1080, height: 1080 },
      { type: "set-layer-fill" },
      {
        type: "set-export",
        format: "mp4",
        codec: "h264",
        crf: 23,
        preset: "medium",
        audioBitrate: "192k",
      },
    ],
  },
  {
    id: "compress-for-telegram",
    title: "Compress for Telegram",
    category: "Compression",
    description: "Smaller file size with faster encoding for messaging apps.",
    difficulty: "simple",
    target: "export",
    requiredFilters: [],
    actions: [
      {
        type: "set-export",
        format: "mp4",
        codec: "h264",
        crf: 26,
        preset: "veryfast",
        audioBitrate: "128k",
        maxOutputWidth: 1280,
      },
    ],
    warnings: [
      "Keep composition width at or below 1280 px for smallest Telegram uploads.",
    ],
  },
  {
    id: "high-quality-master",
    title: "High quality master",
    category: "Export",
    description: "High-quality H.264 master with slow preset and 320k AAC.",
    difficulty: "simple",
    target: "export",
    requiredFilters: [],
    actions: [
      {
        type: "set-export",
        format: "mp4",
        codec: "h264",
        crf: 17,
        preset: "slow",
        audioBitrate: "320k",
      },
    ],
  },
];

export function getFilterRecipeById(id: string): FilterRecipe | undefined {
  return FILTER_RECIPES.find((recipe) => recipe.id === id);
}

export function getFilterRecipesByCategory(category: string): FilterRecipe[] {
  return FILTER_RECIPES.filter((recipe) => recipe.category === category);
}
