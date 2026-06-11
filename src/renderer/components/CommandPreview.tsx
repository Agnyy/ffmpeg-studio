type CommandPreviewProps = {
  command: string;
  note?: string;
};

export default function CommandPreview({ command, note }: CommandPreviewProps) {
  return (
    <div className="command-preview-block">
      <p className="command-preview-note">
        Preview only. FFmpeg runs with a safe argument array, not a shell string.
        {note ? (
          <>
            <br />
            {note}
          </>
        ) : null}
      </p>
      <pre className="command-preview-code">
        {command || "Select a file and preset to preview the FFmpeg command."}
      </pre>
    </div>
  );
}
