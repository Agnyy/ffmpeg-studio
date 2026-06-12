type CommandPreviewProps = {
  command: string;
  note?: string;
};

export default function CommandPreview({ command, note }: CommandPreviewProps) {
  const copyCommand = async () => {
    if (!command) {
      return;
    }
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // ignore
    }
  };

  return (
    <div className="command-preview-block">
      <div className="command-preview-toolbar">
        <p className="command-preview-note">
          Preview only. FFmpeg runs with a safe argument array, not a shell string.
          {note ? (
            <>
              <br />
              {note}
            </>
          ) : null}
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void copyCommand()}
          disabled={!command}
        >
          Copy command
        </button>
      </div>
      <pre className="command-preview-code">
        {command || "Select a file and preset to preview the FFmpeg command."}
      </pre>
    </div>
  );
}
