import { Film } from "lucide-react";
import type { ProjectItem } from "../../shared/project";
import { extractThumbnailDataUrl } from "../../media/thumbnailDebugPipe";
import CompositionIcon from "./CompositionIcon";

type ProjectItemThumbnailProps = {
  item: ProjectItem;
  size?: "sm" | "md";
  className?: string;
};

export default function ProjectItemThumbnail({
  item,
  size = "md",
  className = "",
}: ProjectItemThumbnailProps) {
  const thumbnailDataUrl = extractThumbnailDataUrl(item.thumbnailDataUrl);

  if (item.missing) {
    return (
      <span className={`project-item-thumb-fallback ${className}`} title="Missing media">
        ⚠
      </span>
    );
  }

  if (item.type === "composition") {
    return (
      <span
        className={`project-item-thumb-fallback project-item-thumb-fallback-comp ${className}`}
        title="Composition"
      >
        <CompositionIcon size={size === "sm" ? 16 : 24} />
      </span>
    );
  }

  if (thumbnailDataUrl) {
    return (
      <span className={`project-item-thumb-image-wrap ${className}`}>
        <img
          src={thumbnailDataUrl}
          alt=""
          className={`project-item-thumbnail project-item-thumbnail-${size}`}
        />
      </span>
    );
  }

  return (
    <span
      className={`project-item-thumb-fallback project-item-thumb-fallback-film ${className}`}
      title="Footage"
    >
      <Film size={size === "sm" ? 14 : 22} aria-hidden />
    </span>
  );
}
