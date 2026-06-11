import { Menu, BrowserWindow, app } from "electron";

export type MenuAction =
  | "new-project"
  | "open-project"
  | "save-project"
  | "save-project-as"
  | "import-media"
  | "render"
  | "exit"
  | "undo"
  | "redo"
  | "delete"
  | "reset-workspace"
  | "keyboard-shortcuts"
  | "about";

function sendMenuAction(window: BrowserWindow | null, action: MenuAction): void {
  window?.webContents.send("menu:action", action);
}

export function buildApplicationMenu(getWindow: () => BrowserWindow | null): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuAction(getWindow(), "new-project"),
        },
        {
          label: "Open Project...",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuAction(getWindow(), "open-project"),
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuAction(getWindow(), "save-project"),
        },
        {
          label: "Save As...",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenuAction(getWindow(), "save-project-as"),
        },
        { type: "separator" },
        {
          label: "Import Media...",
          click: () => sendMenuAction(getWindow(), "import-media"),
        },
        {
          label: "Export / Render...",
          click: () => sendMenuAction(getWindow(), "render"),
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Alt+F4",
          click: () => sendMenuAction(getWindow(), "exit"),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () => sendMenuAction(getWindow(), "undo"),
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Y",
          click: () => sendMenuAction(getWindow(), "redo"),
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Shift+Z",
          visible: false,
          click: () => sendMenuAction(getWindow(), "redo"),
        },
        { type: "separator" },
        {
          label: "Delete",
          accelerator: "Delete",
          click: () => sendMenuAction(getWindow(), "delete"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reset Workspace",
          click: () => sendMenuAction(getWindow(), "reset-workspace"),
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Keyboard Shortcuts",
          click: () => sendMenuAction(getWindow(), "keyboard-shortcuts"),
        },
        { type: "separator" },
        {
          label: "About",
          click: () => sendMenuAction(getWindow(), "about"),
        },
      ],
    },
  ];

  if (process.platform === "darwin") {
    template.unshift({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
