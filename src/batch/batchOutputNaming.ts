import {
  getBasenameWithoutExtension,
  getDirname,
  getExtension,
  joinPath,
} from "../shared/pathUtils";

export type BatchFilenameTemplate =
  | "processed"
  | "preset"
  | "telegram"
  | "shorts";

export function getDefaultBatchFilenameTemplate(recipeId: string): BatchFilenameTemplate {
  switch (recipeId) {
    case "compress-for-telegram":
      return "telegram";
    case "prepare-youtube-shorts":
      return "shorts";
    default:
      return "preset";
  }
}

function suffixForRecipe(recipeId: string): string {
  switch (recipeId) {
    case "compress-for-telegram":
      return "telegram";
    case "prepare-youtube-shorts":
      return "shorts";
    case "square-social-video":
      return "square";
    case "high-quality-master":
      return "master";
    case "normalize-voice-audio":
      return "normalized";
    case "clean-voice-audio":
      return "voice_clean";
    case "quick-deshake":
      return "deshake";
    case "clean-noisy-low-light":
      return "denoise";
    case "make-video-sharper":
      return "sharpen";
    default:
      return recipeId.replace(/-/g, "_");
  }
}

export function buildBatchOutputFilename(
  inputPath: string,
  recipeId: string,
  template: BatchFilenameTemplate
): string {
  const base = getBasenameWithoutExtension(inputPath);
  const ext = getExtension(inputPath) || ".mp4";
  const outputExt = ".mp4";

  let suffix: string;
  switch (template) {
    case "processed":
      suffix = "processed";
      break;
    case "telegram":
      suffix = "telegram";
      break;
    case "shorts":
      suffix = "shorts";
      break;
    case "preset":
    default:
      suffix = suffixForRecipe(recipeId);
      break;
  }

  void ext;
  return `${base}_${suffix}${outputExt}`;
}

export function buildBatchOutputPath(
  inputPath: string,
  recipeId: string,
  template: BatchFilenameTemplate,
  outputDir?: string | null
): string {
  const dir = outputDir?.trim() ? outputDir : getDirname(inputPath);
  const filename = buildBatchOutputFilename(inputPath, recipeId, template);
  return joinPath(dir, filename);
}

export async function resolveUniqueOutputPath(
  candidatePath: string,
  checkExists: (paths: string[]) => Promise<Record<string, boolean>>
): Promise<string> {
  const initial = await checkExists([candidatePath]);
  if (!initial[candidatePath]) {
    return candidatePath;
  }

  const dir = getDirname(candidatePath);
  const ext = getExtension(candidatePath) || ".mp4";
  const base = getBasenameWithoutExtension(candidatePath);

  for (let index = 1; index <= 999; index += 1) {
    const numbered = joinPath(dir, `${base}_${String(index).padStart(3, "0")}${ext}`);
    const map = await checkExists([numbered]);
    if (!map[numbered]) {
      return numbered;
    }
  }

  return candidatePath;
}
