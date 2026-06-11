import { useMemo } from "react";
import type { TimelineThumbnail } from "../../media/thumbnailGenerator";

type TimelineThumbnailsProps = {
  thumbnails: TimelineThumbnail[];
  loading?: boolean;
  clipWidth: number;
  inPoint: number;
  outPoint: number;
  sourceDuration: number;
  tileWidth?: number;
};

export default function TimelineThumbnails({
  thumbnails,
  loading = false,
  clipWidth,
  inPoint,
  outPoint,
  sourceDuration,
  tileWidth = 52,
}: TimelineThumbnailsProps) {
  const visibleTiles = useMemo(() => {
    if (thumbnails.length === 0 || sourceDuration <= 0) {
      return [];
    }

    const segmentDuration = Math.max(outPoint - inPoint, 0.01);
    const tileCount = Math.max(1, Math.min(Math.floor(clipWidth / tileWidth), 20));

    return Array.from({ length: tileCount }, (_, index) => {
      const ratio = tileCount === 1 ? 0.5 : index / (tileCount - 1);
      const sourceTime = inPoint + segmentDuration * ratio;
      const nearest = thumbnails.reduce((best, thumb) => {
        const bestDistance = Math.abs(best.time - sourceTime);
        const nextDistance = Math.abs(thumb.time - sourceTime);
        return nextDistance < bestDistance ? thumb : best;
      }, thumbnails[0]);
      return nearest;
    });
  }, [clipWidth, inPoint, outPoint, sourceDuration, thumbnails, tileWidth]);

  if (loading) {
    return <div className="timeline-thumbnails timeline-thumbnails-loading" />;
  }

  if (visibleTiles.length === 0) {
    return null;
  }

  return (
    <div className="timeline-thumbnails" aria-hidden>
      {visibleTiles.map((thumb, index) => (
        <img
          key={`${thumb.time}-${index}`}
          className="timeline-thumbnail-tile"
          src={thumb.dataUrl}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  );
}
