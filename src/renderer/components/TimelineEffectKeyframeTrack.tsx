import { useRef } from "react";
import KeyframeMarkerIcon from "./KeyframeMarkerIcon";
import type { TimelineLayer } from "../../shared/project";
import type { SelectedKeyframeRef } from "../../keyframes/keyframeSelection";
import { isKeyframeSelected } from "../../keyframes/keyframeSelection";
import type { KeyframeContextMenuState } from "./KeyframeContextMenu";
import { timeToX } from "../utils/timelineZoom";
import { snapTimeToFrame } from "../utils/time";

type TimelineEffectKeyframeTrackProps = {
  layer: TimelineLayer;
  effectId: string;
  param: string;
  label: string;
  timelineZoom: number;
  propertyRowHeight: number;
  contentWidth: number;
  fps: number;
  compCurrentTime: number;
  selectedKeyframes: SelectedKeyframeRef[];
  onSeek: (time: number) => void;
  onSelectKeyframe: (selection: SelectedKeyframeRef, options?: { additive?: boolean }) => void;
  onMoveEffectKeyframe: (
    layerId: string,
    effectId: string,
    param: string,
    keyframeId: string,
    newTime: number
  ) => void;
  onKeyframeDragStart?: () => void;
  onKeyframeDragEnd?: () => void;
  onOpenContextMenu?: (state: NonNullable<KeyframeContextMenuState>) => void;
};

export default function TimelineEffectKeyframeTrack({
  layer,
  effectId,
  param,
  label,
  timelineZoom,
  propertyRowHeight,
  contentWidth,
  fps,
  compCurrentTime,
  selectedKeyframes,
  onSeek,
  onSelectKeyframe,
  onMoveEffectKeyframe,
  onKeyframeDragStart,
  onKeyframeDragEnd,
  onOpenContextMenu,
}: TimelineEffectKeyframeTrackProps) {
  const dragRef = useRef<{
    keyframeId: string;
    startX: number;
    initialTime: number;
  } | null>(null);

  const effect = layer.effects?.find((entry) => entry.id === effectId);
  const property = effect?.keyframes?.[param];

  if (!effect || !property?.enabled) {
    return (
      <div
        className="timeline-track-row timeline-keyframe-track timeline-keyframe-track-empty"
        style={{ height: propertyRowHeight, width: contentWidth }}
      />
    );
  }

  const markers = property.keyframes.map((kf) => ({
    id: kf.id,
    time: kf.time,
    interpolation: kf.interpolation ?? "linear",
  }));

  const handlePointerDown = (
    event: React.PointerEvent,
    keyframeId: string,
    time: number
  ) => {
    event.stopPropagation();
    event.preventDefault();
    onSelectKeyframe(
      { kind: "effect", layerId: layer.id, effectId, param, keyframeId },
      { additive: event.shiftKey }
    );
    onSeek(time);
    dragRef.current = { keyframeId, startX: event.clientX, initialTime: time };
    onKeyframeDragStart?.();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handleContextMenu = (
    event: React.MouseEvent,
    keyframeId: string,
    time: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (
      !isKeyframeSelected(selectedKeyframes, layer.id, {
        kind: "effect",
        effectId,
        param,
        keyframeId,
      })
    ) {
      onSelectKeyframe({ kind: "effect", layerId: layer.id, effectId, param, keyframeId });
    }
    onSeek(time);
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
    onMoveEffectKeyframe(layer.id, effectId, param, drag.keyframeId, newTime);
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
      className="timeline-track-row timeline-keyframe-track timeline-effect-keyframe-track"
      style={{ height: propertyRowHeight, width: contentWidth }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="timeline-track-bg" />
      {markers.map((marker) => {
        const selected = isKeyframeSelected(selectedKeyframes, layer.id, {
          kind: "effect",
          effectId,
          param,
          keyframeId: marker.id,
        });
        const atPlayhead = Math.abs(marker.time - compCurrentTime) < 0.05;
        const interpClass = `interpolation-${marker.interpolation}`;
        return (
          <button
            key={`${marker.id}-${marker.interpolation ?? "linear"}`}
            type="button"
            className={`timeline-keyframe-marker ${interpClass} ${selected ? "selected" : ""} ${atPlayhead ? "at-playhead" : ""}`}
            style={{ left: timeToX(marker.time, timelineZoom) }}
            title={`${label} keyframe @ ${marker.time.toFixed(2)}s (${marker.interpolation})`}
            onPointerDown={(event) => handlePointerDown(event, marker.id, marker.time)}
            onContextMenu={(event) => handleContextMenu(event, marker.id, marker.time)}
            onClick={(event) => event.stopPropagation()}
          >
            <KeyframeMarkerIcon
              interpolation={marker.interpolation}
              atPlayhead={atPlayhead}
              selected={selected}
            />
          </button>
        );
      })}
    </div>
  );
}
