import { getPresetById } from "../presets";
import { getResizeOutputSuffix } from "../presets/resizeVideo";
import {
  getBasename,
  getBasenameWithoutExtension,
  getDirname,
  joinPath,
} from "../shared/pathUtils";
import type { Job, PresetOptions } from "../shared/types";

function createJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function baseJob(
  partial: Pick<Job, "jobKind" | "title" | "inputPath" | "outputPath" | "args"> &
    Partial<Job>
): Job {
  return {
    id: partial.id ?? createJobId(),
    jobKind: partial.jobKind,
    title: partial.title,
    status: partial.status ?? "pending",
    progress: partial.progress ?? 0,
    log: partial.log ? [...partial.log] : [],
    error: partial.error,
    createdAt: partial.createdAt ?? nowIso(),
    startedAt: partial.startedAt,
    finishedAt: partial.finishedAt,
    command: partial.command,
    args: [...partial.args],
    inputPath: partial.inputPath,
    outputPath: partial.outputPath,
    presetId: partial.presetId,
    durationSeconds: partial.durationSeconds,
    label: partial.label,
    relatedLayerId: partial.relatedLayerId,
    relatedEffectId: partial.relatedEffectId,
    relatedProjectItemId: partial.relatedProjectItemId,
  };
}

export function createProxyJob(options: {
  inputPath: string;
  outputPath: string;
  args: string[];
  projectItemId: string;
  command?: string;
  durationSeconds?: number;
}): Job {
  const name = getBasename(options.inputPath);
  return baseJob({
    jobKind: "proxy",
    title: `Create Preview Proxy: ${name}`,
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    args: options.args,
    presetId: "preview-proxy",
    relatedProjectItemId: options.projectItemId,
    command: options.command,
    durationSeconds: options.durationSeconds,
  });
}

export function createPreviewCacheJob(options: {
  inputPath: string;
  outputPath: string;
  args: string[];
  cacheId: string;
  compositionName: string;
  command?: string;
  durationSeconds: number;
}): Job {
  return baseJob({
    jobKind: "preview-cache",
    title: `Cache Preview: ${options.compositionName}`,
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    args: options.args,
    presetId: "preview-cache",
    command: options.command,
    durationSeconds: options.durationSeconds,
  });
}

export function createVidstabAnalysisJob(options: {
  inputPath: string;
  trfPath: string;
  args: string[];
  layerId: string;
  effectId: string;
  layerName: string;
  command?: string;
  durationSeconds?: number;
}): Job {
  return baseJob({
    jobKind: "analysis",
    title: `Analyze Stabilization: ${options.layerName}`,
    inputPath: options.inputPath,
    outputPath: options.trfPath,
    args: options.args,
    presetId: "analysis-vidstab",
    relatedLayerId: options.layerId,
    relatedEffectId: options.effectId,
    command: options.command,
    durationSeconds: options.durationSeconds,
  });
}

export function createCompositionRenderJob(
  primaryInputPath: string,
  outputPath: string,
  args: string[],
  durationSeconds: number,
  compositionName: string,
  existingId?: string,
  command?: string
): Job {
  return baseJob({
    id: existingId,
    jobKind: "render",
    title: `Render Composition: ${compositionName}`,
    inputPath: primaryInputPath,
    outputPath,
    args,
    presetId: "export-composition",
    durationSeconds,
    command,
  });
}

function buildOutputPath(
  inputPath: string,
  presetId: string,
  extension: string,
  suffix: string,
  options?: PresetOptions
): string {
  const dir = getDirname(inputPath);
  const base = getBasenameWithoutExtension(inputPath);

  let finalSuffix = suffix;
  if (presetId === "resize-video" && options?.resize) {
    finalSuffix = getResizeOutputSuffix(options.resize);
  }

  return joinPath(dir, `${base}${finalSuffix}${extension}`);
}

export function createEditClipJob(
  inputPath: string,
  editOptions: import("../shared/clipEdit").EditClipOptions,
  existingId?: string,
  durationSeconds?: number
): Job {
  const preset = getPresetById("edit-clip");
  if (!preset) {
    throw new Error("Edit clip preset not found");
  }

  const outputPath = buildOutputPath(
    inputPath,
    "edit-clip",
    preset.outputExtension,
    preset.outputSuffix
  );

  const args = preset.buildArgs(inputPath, outputPath, { editClip: editOptions });

  return baseJob({
    id: existingId,
    jobKind: "render",
    title: `Edit Clip: ${getBasename(inputPath)}`,
    inputPath,
    outputPath,
    args,
    presetId: "edit-clip",
    durationSeconds: durationSeconds ?? editOptions.trimEnd - editOptions.trimStart,
  });
}

export function createJob(
  inputPath: string,
  presetId: string,
  options?: PresetOptions
): Job {
  const preset = getPresetById(presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }

  const outputPath = buildOutputPath(
    inputPath,
    presetId,
    preset.outputExtension,
    preset.outputSuffix,
    options
  );

  const args = preset.buildArgs(inputPath, outputPath, options);

  return baseJob({
    jobKind: "render",
    title: `${preset.title}: ${getBasename(inputPath)}`,
    inputPath,
    outputPath,
    args,
    presetId,
  });
}

export function rebuildJobArgs(job: Job, options?: PresetOptions): Job {
  const preset = getPresetById(job.presetId ?? "");
  if (!preset) {
    return job;
  }

  return {
    ...job,
    args: preset.buildArgs(job.inputPath, job.outputPath, options),
  };
}
