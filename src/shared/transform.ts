export type LayerTransform = {
  positionX: number;
  positionY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  anchorX: number;
  anchorY: number;
};

export function createDefaultTransform(
  compositionWidth: number,
  compositionHeight: number
): LayerTransform {
  return {
    positionX: compositionWidth / 2,
    positionY: compositionHeight / 2,
    scaleX: 100,
    scaleY: 100,
    rotation: 0,
    opacity: 100,
    anchorX: 0.5,
    anchorY: 0.5,
  };
}
