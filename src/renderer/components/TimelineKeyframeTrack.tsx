import { useRef } from "react";
import KeyframeMarkerIcon from "./KeyframeMarkerIcon";
import { resolveTransformGroupInterpolation } from "../utils/keyframeMarkerInterpolation";
import type { TimelineLayer } from "../../shared/project";
import type {
  KeyframeInterpolation,
  TransformGroupKey,
  TransformPropertyKey,
} from "../../keyframes/keyframeTypes";
import { TRANSFORM_GROUP_PROPERTIES } from "../../keyframes/keyframeTypes";
import { isTransformGroupEnabled } from "../../keyframes/layerTransformKeyframes";
import type { SelectedKeyframeRef } from "../../keyframes/keyframeSelection";
import { isKeyframeSelected } from "../../keyframes/keyframeSelection";
import type { KeyframeContextMenuState } from "./KeyframeContextMenu";
import { timeToX } from "../utils/timelineZoom";
import { snapTimeToFrame } from "../utils/time";

export type { SelectedKeyframeRef };

type KeyframeMarker = {
  property: TransformPropertyKey;
  id: string;
  time: number;
  interpolation: KeyframeInterpolation;
};

type TimelineKeyframeTrackProps = {
  layer: TimelineLayer;
  group: TransformGroupKey;
  label: string;
  timelineZoom: number;
  propertyRowHeight: number;
  contentWidth: number;
  fps: number;
  compCurrentTime: number;
  selectedKeyframes: SelectedKeyframeRef[];
  onSeek: (time: number) => void;
  onSelectKeyframe: (selection: SelectedKeyframeRef, options?: { additive?: boolean }) => void;
  onMoveKeyframe: (
    layerId: string,
    property: TransformPropertyKey,
    keyframeId: string,
    newTime: number
  ) => void;
  onKeyframeDragStart?: () => void;
  onKeyframeDragEnd?: () => void;
  onOpenContextMenu?: (state: NonNullable<KeyframeContextMenuState>) => void;
  highlighted?: boolean;
  hovered?: boolean;
  rowKey?: string;
  onRowHover?: (rowKey: string | null) => void;
};

function collectGroupKeyframes(layer: TimelineLayer, group: TransformGroupKey): KeyframeMarker[] {
  const entries: KeyframeMarker[] = [];
  for (const key of TRANSFORM_GROUP_PROPERTIES[group]) {
    const property = layer.keyframes[key];
    if (!property.enabled) {
      continue;
    }
    for (const kf of property.keyframes) {
      entries.push({
        property: key,
        id: kf.id,
        time: kf.time,
        interpolation: kf.interpolation ?? "linear",
      });
    }
  }
  return entries;
}

type GroupedKeyframeMarker = {
  time: number;
  markers: KeyframeMarker[];
};

function groupMarkersByTime(markers: KeyframeMarker[], tolerance = 0.001): GroupedKeyframeMarker[] {
  const groups: GroupedKeyframeMarker[] = [];
  for (const marker of markers) {
    const existing = groups.find(
      (group) => Math.abs(group.time - marker.time) < tolerance
    );
    if (existing) {
      existing.markers.push(marker);
      continue;
    }
    groups.push({
      time: marker.time,
      markers: [marker],
    });
  }
  return groups;
}

export default function TimelineKeyframeTrack({
  layer,
  group,
  label,
  timelineZoom,
  propertyRowHeight,
  contentWidth,
  fps,
  compCurrentTime,
  selectedKeyframes,
  onSeek,
  onSelectKeyframe,
  onMoveKeyframe,
  onKeyframeDragStart,
  onKeyframeDragEnd,
  onOpenContextMenu,
  highlighted = false,
  hovered = false,
  rowKey,
  onRowHover,
}: TimelineKeyframeTrackProps) {
  const dragRef = useRef<{
    markers: KeyframeMarker[];
    startX: number;
    initialTime: number;
  } | null>(null);

  const rowClassName = [
    "timeline-track-row",
    "timeline-keyframe-track",
    highlighted ? "timeline-property-row-highlighted" : "",
    hovered ? "timeline-property-row-hovered" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!isTransformGroupEnabled(layer.keyframes, group)) {
    return (
      <div
        className={`${rowClassName} timeline-keyframe-track-empty`}
        style={{ height: propertyRowHeight, width: contentWidth }}
        onMouseEnter={() => rowKey && onRowHover?.(rowKey)}
        onMouseLeave={() => onRowHover?.(null)}
      />
    );
  }

  const markers = collectGroupKeyframes(layer, group);
  const groupedMarkers = groupMarkersByTime(markers);

  const handlePointerDown = (
    event: React.PointerEvent,
    groupMarker: GroupedKeyframeMarker
  ) => {
    event.stopPropagation();
    event.preventDefault();
    groupMarker.markers.forEach((marker, index) => {
      onSelectKeyframe(
        { kind: "transform", layerId: layer.id, property: marker.property, keyframeId: marker.id },
        { additive: event.shiftKey || index > 0 }
      );
    });
    onSeek(groupMarker.time);
    dragRef.current = {
      markers: groupMarker.markers,
      startX: event.clientX,
      initialTime: groupMarker.time,
    };
    onKeyframeDragStart?.();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handleContextMenu = (
    event: React.MouseEvent,
    groupMarker: GroupedKeyframeMarker
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const anySelected = groupMarker.markers.some((marker) =>
      isKeyframeSelected(selectedKeyframes, layer.id, {
        kind: "transform",
        property: marker.property,
        keyframeId: marker.id,
      })
    );
    if (!anySelected) {
      const primary = groupMarker.markers[0];
      onSelectKeyframe({
        kind: "transform",
        layerId: layer.id,
        property: primary.property,
        keyframeId: primary.id,
      });
    }
    onSeek(groupMarker.time);
    onOpenContextMenu?.({ x: event.clientX, y: event.clientY });
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const deltaX = event.clientX - drag.startX;
    const deltaTime = deltaX / timelineZoom;
    const newTime = snapTimeToFrame(Math.max(0, drag.initialTime + deltaTime), fps);
    for (const marker of drag.markers) {
      onMoveKeyframe(layer.id, marker.property, marker.id, newTime);
    }
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (!dragRef.current) {
      return;
    }
    dragRef.current = null;
    onKeyframeDragEnd?.();
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={rowClassName}
      style={{ height: propertyRowHeight, width: contentWidth }}
      onMouseEnter={() => rowKey && onRowHover?.(rowKey)}
      onMouseLeave={() => onRowHover?.(null)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="timeline-track-bg" />
      {groupedMarkers.map((groupMarker) => {
        const selected = groupMarker.markers.some((marker) =>
          isKeyframeSelected(selectedKeyframes, layer.id, {
            kind: "transform",
            property: marker.property,
            keyframeId: marker.id,
          })
        );
        const atPlayhead = Math.abs(groupMarker.time - compCurrentTime) < 0.05;
        const interpolation = resolveTransformGroupInterpolation(
          groupMarker.markers,
          layer.id,
          selectedKeyframes
        );
        const interpClass = `interpolation-${interpolation}`;
        const stacked = groupMarker.markers.length > 1;
        const markerKey = groupMarker.markers
          .map((marker) => `${marker.property}-${marker.id}-${marker.interpolation ?? "linear"}`)
          .join("|");
        return (
          <button
            key={`${groupMarker.time}-${interpolation}-${markerKey}`}
            type="button"
            className={`timeline-keyframe-marker ${interpClass} ${selected ? "selected" : ""} ${atPlayhead ? "at-playhead" : ""} ${stacked ? "grouped" : ""}`}
            style={{ left: timeToX(groupMarker.time, timelineZoom) }}
            title={`${label} keyframe @ ${groupMarker.time.toFixed(2)}s (${interpolation})`}
            onPointerDown={(event) => handlePointerDown(event, groupMarker)}
            onContextMenu={(event) => handleContextMenu(event, groupMarker)}
            onClick={(event) => event.stopPropagation()}
          >
            <KeyframeMarkerIcon
              interpolation={interpolation}
              atPlayhead={atPlayhead}
              selected={selected}
            />
          </button>
        );
      })}
    </div>
  );
}
