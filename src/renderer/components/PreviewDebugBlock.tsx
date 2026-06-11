import type { Job } from "../../shared/types";
import type { ProjectItem } from "../../shared/project";
import { buildPreviewDebugInfo } from "../../media/previewState";

type PreviewDebugBlockProps = {
  item: ProjectItem;
  jobs?: Job[];
  className?: string;
};

export default function PreviewDebugBlock({
  item,
  jobs = [],
  className = "",
}: PreviewDebugBlockProps) {
  if (item.type !== "footage") {
    return null;
  }

  const debug = buildPreviewDebugInfo(item, jobs);

  return (
    <dl className={`preview-debug-block ${className}`.trim()}>
      <div>
        <dt>sourcePath</dt>
        <dd>{debug.sourcePath}</dd>
      </div>
      <div>
        <dt>previewPath</dt>
        <dd>{debug.previewPath}</dd>
      </div>
      <div>
        <dt>proxyPath</dt>
        <dd>{debug.proxyPath}</dd>
      </div>
      <div>
        <dt>compatibilityStatus</dt>
        <dd>{debug.compatibilityStatus}</dd>
      </div>
      <div>
        <dt>Preview source</dt>
        <dd>{debug.previewSource}</dd>
      </div>
      <div>
        <dt>Proxy job status</dt>
        <dd>{debug.proxyJobStatus}</dd>
      </div>
    </dl>
  );
}
