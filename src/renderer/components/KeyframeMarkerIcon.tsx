import type { ReactNode } from "react";
import type { KeyframeInterpolation } from "../../keyframes/keyframeTypes";

export type KeyframeMarkerIconProps = {
  interpolation: KeyframeInterpolation | string;
  atPlayhead?: boolean;
  selected?: boolean;
  size?: number;
};

type NormalizedInterpolation = "linear" | "hold" | "easyEase" | "easeIn" | "easeOut";

function normalizeInterpolation(interpolation: string): NormalizedInterpolation | null {
  switch (interpolation) {
    case "linear":
      return "linear";
    case "hold":
      return "hold";
    case "easy":
    case "easy-ease":
    case "ease":
    case "easeInOut":
      return "easyEase";
    case "ease-in":
    case "easeIn":
      return "easeIn";
    case "ease-out":
    case "easeOut":
      return "easeOut";
    default:
      return null;
  }
}

type ShapeStyle = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
};

function renderShape(type: NormalizedInterpolation, style: ShapeStyle): ReactNode {
  const common = {
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    opacity: style.opacity,
    vectorEffect: "non-scaling-stroke" as const,
  };

  switch (type) {
    case "linear":
      return <polygon points="8,1.5 14.5,8 8,14.5 1.5,8" {...common} />;
    case "hold":
      return <rect x="3" y="3" width="10" height="10" rx="1.2" {...common} />;
    case "easyEase":
      return (
        <>
          <polygon points="3,2.5 13,2.5 8,7.5" {...common} />
          <polygon points="3,13.5 13,13.5 8,8.5" {...common} />
        </>
      );
    case "easeIn":
      return <path d="M3 2.5 H8 L13 8 L8 13.5 H3 L7.2 8 Z" {...common} />;
    case "easeOut":
      return <path d="M13 2.5 H8 L3 8 L8 13.5 H13 L8.8 8 Z" {...common} />;
  }
}

export default function KeyframeMarkerIcon({
  interpolation,
  atPlayhead = false,
  selected = false,
  size = 14,
}: KeyframeMarkerIconProps) {
  const isCurrent = atPlayhead;
  const isSelected = selected;

  const fill = isCurrent ? "#ff4fa3" : isSelected ? "#ff66b3" : "#9b6a8c";
  const stroke = isSelected || isCurrent ? "#ffffff" : "rgba(255,255,255,0.35)";
  const opacity = isSelected || isCurrent ? 1 : 0.75;
  const strokeWidth = isSelected || isCurrent ? 1.5 : 0.8;

  const normalized = normalizeInterpolation(interpolation);
  let shapeType: NormalizedInterpolation;
  if (normalized) {
    shapeType = normalized;
  } else {
    console.warn("[KEYFRAME_ICON] Unknown interpolation", interpolation);
    shapeType = "linear";
  }

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden
      className="keyframe-marker-svg"
    >
      {renderShape(shapeType, { fill, stroke, strokeWidth, opacity })}
    </svg>
  );
}
