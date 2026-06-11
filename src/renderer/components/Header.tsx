import type { FfmpegResolveResult } from "../../shared/types";

type HeaderProps = {
  ffmpegStatus: FfmpegResolveResult | null;
  onOpenSettings: () => void;
};

function statusLabel(status: FfmpegResolveResult | null): {
  text: string;
  className: string;
} {
  if (!status) {
    return { text: "Checking…", className: "status-checking" };
  }
  if (status.ok) {
    return { text: "Found", className: "status-found" };
  }
  return { text: status.error ? "Error" : "Missing", className: "status-missing" };
}

export default function Header({ ffmpegStatus, onOpenSettings }: HeaderProps) {
  const status = statusLabel(ffmpegStatus);

  return (
    <header className="header panel">
      <div className="header-left">
        <h1 className="header-title">FFmpeg Studio</h1>
        <p className="header-subtitle">Simple visual GUI for FFmpeg</p>
      </div>
      <div className="header-right">
        <div className={`ffmpeg-status ${status.className}`}>
          <span className="ffmpeg-status-dot" />
          <span>FFmpeg: {status.text}</span>
          {ffmpegStatus?.ok && ffmpegStatus.source && (
            <span className="ffmpeg-status-source">({ffmpegStatus.source})</span>
          )}
        </div>
        <button type="button" className="btn btn-secondary" onClick={onOpenSettings}>
          Settings
        </button>
      </div>

      <style>{`
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: 16px 16px 0;
          border-radius: var(--radius);
        }
        .header-left {
          min-width: 0;
        }
        .header-title {
          margin: 0;
          font-size: 1.5rem;
        }
        .header-subtitle {
          margin: 4px 0 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        .ffmpeg-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          font-size: 0.875rem;
        }
        .ffmpeg-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-muted);
        }
        .status-found .ffmpeg-status-dot {
          background: var(--success);
        }
        .status-missing .ffmpeg-status-dot,
        .status-checking .ffmpeg-status-dot {
          background: var(--warning);
        }
        .status-missing .ffmpeg-status-dot {
          background: var(--error);
        }
        .ffmpeg-status-source {
          color: var(--text-muted);
        }
      `}</style>
    </header>
  );
}
