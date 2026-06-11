import { getBasename } from "../../shared/pathUtils";
import { getPresetById } from "../../presets";
import type { Job } from "../../shared/types";
import MediaPanel, { type MediaEntry } from "./MediaPanel";
import PresetsPanel from "./PresetsPanel";

export type SidebarTab = "media" | "presets" | "queue";

type LeftSidebarProps = {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  mediaEntries: MediaEntry[];
  selectedInputPath: string | null;
  onSelectMedia: (inputPath: string) => void;
  onFilesAdded: (paths: string[]) => void;
  selectedPresetId: string;
  onPresetChange: (presetId: string) => void;
  jobs: Job[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
};

function statusLabel(status: Job["status"]): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "running":
      return "Running";
    case "done":
      return "Done";
    case "error":
      return "Error";
    case "cancelled":
      return "Cancelled";
  }
}

export default function LeftSidebar({
  activeTab,
  onTabChange,
  mediaEntries,
  selectedInputPath,
  onSelectMedia,
  onFilesAdded,
  selectedPresetId,
  onPresetChange,
  jobs,
  selectedJobId,
  onSelectJob,
}: LeftSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        {(["media", "presets", "queue"] as SidebarTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`sidebar-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="sidebar-content">
        {activeTab === "media" && (
          <MediaPanel
            entries={mediaEntries}
            selectedInputPath={selectedInputPath}
            onSelect={onSelectMedia}
            onFilesAdded={onFilesAdded}
          />
        )}

        {activeTab === "presets" && (
          <PresetsPanel
            selectedPresetId={selectedPresetId}
            onPresetChange={onPresetChange}
          />
        )}

        {activeTab === "queue" && (
          <div className="panel-section">
            <p className="panel-section-title">Queue ({jobs.length})</p>
            {jobs.length === 0 ? (
              <p className="empty-sidebar">No jobs in queue</p>
            ) : (
              <div className="queue-sidebar-list">
                {jobs.map((job) => {
                  const preset = job.presetId ? getPresetById(job.presetId) : undefined;
                  return (
                    <div
                      key={job.id}
                      className={`queue-sidebar-item ${selectedJobId === job.id ? "selected" : ""}`}
                      onClick={() => onSelectJob(job.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          onSelectJob(job.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="queue-sidebar-name">{getBasename(job.inputPath)}</div>
                      <div className="queue-sidebar-status">
                        {preset?.title ?? job.presetId} · {statusLabel(job.status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
