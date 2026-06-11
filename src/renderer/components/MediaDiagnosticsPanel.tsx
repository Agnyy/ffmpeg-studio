import { useState } from "react";
import type { ProjectItem } from "../../shared/project";
import {
  buildCompatibilityInfo,
  compatibilityStatusLabel,
  getSafePreviewPathForItem,
} from "../../media/mediaCompatibility";

type MediaDiagnosticsPanelProps = {
  item: ProjectItem;
};

export default function MediaDiagnosticsPanel({ item }: MediaDiagnosticsPanelProps) {
  const [open, setOpen] = useState(false);
  const compat = buildCompatibilityInfo(item);

  if (item.type !== "footage") {
    return null;
  }

  return (
    <div className="media-diagnostics-panel">
      <button
        type="button"
        className="media-diagnostics-toggle"
        onClick={() => setOpen((value) => !value)}
        title="Media diagnostics"
      >
        i
      </button>
      {open && (
        <div className="media-diagnostics-body">
          <div>
            <strong>Original</strong>
            <div>{item.originalPath ?? item.path}</div>
          </div>
          <div>
            <strong>Preview</strong>
            <div>
              {getSafePreviewPathForItem(item) ??
                (compat?.needsProxy ? "Native failed / proxy needed" : "Not available")}
            </div>
          </div>
          <div>
            <strong>Proxy</strong>
            <div>{item.proxyPath ?? "—"}</div>
          </div>
          <div>
            <strong>Status</strong>
            <div>{compatibilityStatusLabel(item.compatibilityStatus)}</div>
          </div>
          {item.compatibilityReason && (
            <div>
              <strong>Reason</strong>
              <div>{item.compatibilityReason}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
