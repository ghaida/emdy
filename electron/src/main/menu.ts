import { Menu, app } from 'electron';

type MenuCallback = (event: string) => void;

export function buildMenu(sendEvent: MenuCallback) {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        {
          label: 'About Emdy',
          click: () => sendEvent('show-about'),
        },
        {
          label: 'Check for Updates…',
          click: () => sendEvent('check-for-updates'),
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendEvent('open'),
        },
        { type: 'separator' },
        {
          label: 'Export as PDF...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => sendEvent('export-pdf'),
        },
        {
          label: 'Print...',
          accelerator: 'CmdOrCtrl+P',
          click: () => sendEvent('print'),
        },
        { type: 'separator' },
        ...(isMac ? [] : [{ role: 'quit' as const }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' as const },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' as const },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendEvent('find'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => sendEvent('zoom-in'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => sendEvent('zoom-out'),
        },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendEvent('zoom-reset'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendEvent('toggle-sidebar'),
        },
        {
          label: 'Toggle Minimap',
          accelerator: 'CmdOrCtrl+M',
          click: () => sendEvent('toggle-minimap'),
        },
        { type: 'separator' },
        {
          label: 'Sans Serif Font',
          click: () => sendEvent('font-sans'),
        },
        {
          label: 'Serif Font',
          click: () => sendEvent('font-serif'),
        },
        {
          label: 'Monospace Font',
          click: () => sendEvent('font-mono'),
        },
        { type: 'separator' },
        {
          label: 'Warm Color Theme',
          click: () => sendEvent('theme-warm'),
        },
        {
          label: 'Cool Color Theme',
          click: () => sendEvent('theme-cool'),
        },
        {
          label: 'Neutral Color Theme',
          click: () => sendEvent('theme-neutral'),
        },
        { type: 'separator' },
        {
          label: 'Light Theme',
          click: () => sendEvent('theme-light'),
        },
        {
          label: 'Dark Theme',
          click: () => sendEvent('theme-dark'),
        },
        {
          label: 'System Theme',
          click: () => sendEvent('theme-system'),
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          click: () => sendEvent('show-shortcuts'),
        },
        { type: 'separator' },
        {
          label: 'About Emdy',
          click: () => sendEvent('show-about'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
