import {
  buildCompositionRenderArgs,
  type CompositionRenderInput,
} from "./compositionRenderBuilder";

export function buildPreviewCacheRenderInput(
  input: CompositionRenderInput
): CompositionRenderInput {
  const previewWidth = Math.min(1280, Math.max(2, input.composition.width));
  const previewHeight = Math.round(
    (previewWidth / input.composition.width) * input.composition.height
  );
  return {
    ...input,
    composition: {
      ...input.composition,
      width: previewWidth,
      height: Math.max(2, previewHeight),
    },
    exportCrf: 28,
    exportPreset: "veryfast",
  };
}

export function buildPreviewCacheArgs(input: CompositionRenderInput): string[] {
  const previewInput = buildPreviewCacheRenderInput(input);
  const result = buildCompositionRenderArgs(previewInput);
  const args = [...result.args];
  const outIndex = args.lastIndexOf(previewInput.outputPath);
  if (outIndex > 0) {
    args.splice(outIndex, 0, "-pix_fmt", "yuv420p");
  }
  return args;
}
