import { DragEvent } from "react";

type FileDropZoneProps = {
  onFilesAdded: (paths: string[]) => void;
};

export default function FileDropZone({ onFilesAdded }: FileDropZoneProps) {
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");

    const paths = Array.from(event.dataTransfer.files)
      .map((file) => file.path)
      .filter(Boolean);

    if (paths.length > 0) {
      onFilesAdded(paths);
    }
  };

  const handleBrowse = async () => {
    const paths = await window.ffmpegStudio.openFileDialog();
    if (paths.length > 0) {
      onFilesAdded(paths);
    }
  };

  return (
    <section className="dropzone panel">
      <div
        className="dropzone-area"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("drag-over");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("drag-over");
        }}
        onDrop={handleDrop}
      >
        <div className="dropzone-icon">+</div>
        <h2 className="panel-title">Drop video files here</h2>
        <p className="dropzone-text">
          Drag and drop one or more video files, or browse from your computer.
        </p>
        <button type="button" className="btn" onClick={handleBrowse}>
          Browse Files
        </button>
      </div>

      <style>{`
        .dropzone-area {
          border: 2px dashed var(--border);
          border-radius: var(--radius);
          padding: 40px 24px;
          text-align: center;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .dropzone-area.drag-over {
          border-color: var(--accent);
          background: rgba(79, 140, 255, 0.08);
        }
        .dropzone-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 16px;
          border-radius: 50%;
          background: var(--bg-elevated);
          display: grid;
          place-items: center;
          font-size: 2rem;
          color: var(--accent);
        }
        .dropzone-text {
          margin: 0 0 20px;
          color: var(--text-secondary);
        }
      `}</style>
    </section>
  );
}
