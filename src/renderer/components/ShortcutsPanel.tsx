import { DEFAULT_SHORTCUTS } from "../../commands/commandRegistry";
import type { ShortcutCategory } from "../../commands/commandTypes";

type ShortcutsPanelProps = {
  open: boolean;
  onClose: () => void;
};

const CATEGORY_ORDER: ShortcutCategory[] = [
  "Playback",
  "Timeline",
  "Layer",
  "Tools",
  "Properties",
  "Edit",
  "Project",
];

export default function ShortcutsPanel({ open, onClose }: ShortcutsPanelProps) {
  if (!open) {
    return null;
  }

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: DEFAULT_SHORTCUTS.filter((entry) => entry.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal shortcuts-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="shortcuts-modal-body">
          {byCategory.map((group) => (
            <section key={group.category} className="shortcuts-category">
              <h3 className="shortcuts-category-title">{group.category}</h3>
              <table className="shortcuts-table">
                <thead>
                  <tr>
                    <th>Shortcut</th>
                    <th>Action</th>
                    <th>Familiar</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={`${item.commandId}-${item.keys.join(",")}`}>
                      <td className="shortcuts-keys">
                        {item.keys.map((key) => (
                          <kbd key={key}>{key}</kbd>
                        ))}
                      </td>
                      <td>{item.label}</td>
                      <td>{item.aeLike ? "Yes" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
