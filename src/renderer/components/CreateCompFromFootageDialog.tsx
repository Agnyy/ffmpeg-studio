import type { ProjectItem } from "../../shared/project";

type CreateCompFromFootageDialogProps = {
  footage: ProjectItem;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function CreateCompFromFootageDialog({
  footage,
  onConfirm,
  onCancel,
}: CreateCompFromFootageDialogProps) {
  return (
    <div className="recipe-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="recipe-dialog create-comp-dialog"
        role="dialog"
        aria-labelledby="create-comp-footage-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="create-comp-footage-title" className="recipe-dialog-title">
          Create Composition from Footage
        </h3>
        <p className="recipe-dialog-body">
          Create a new composition using settings from <strong>{footage.name}</strong>?
        </p>
        <div className="recipe-dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Create Composition
          </button>
        </div>
      </div>
    </div>
  );
}
