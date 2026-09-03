import { app, Menu, BrowserWindow, dialog } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { IpcChannel, type MenuCommand } from '../shared/types';
import { listMarkdownFiles } from './fs/listMd';

const MARKDOWN_FILTER = { name: 'Markdown', extensions: ['md', 'markdown'] };
const isMac = process.platform === 'darwin';

function targetWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

/** 살아있는 창으로 파일 경로 push. OS 파일 연결 경로(index.ts)도 이 함수를 재사용한다. */
export function sendFilesOpened(paths: string[]): void {
  const win = targetWindow();
  if (win && paths.length > 0) {
    win.webContents.send(IpcChannel.AppFilesOpened, paths);
  }
}

function sendMenuCommand(command: MenuCommand): void {
  const win = targetWindow();
  if (win) win.webContents.send(IpcChannel.AppMenuCommand, command);
}

async function pickFiles(parent: BrowserWindow | null): Promise<string[]> {
  const opts: Electron.OpenDialogOptions = {
    properties: ['openFile', 'multiSelections'],
    filters: [MARKDOWN_FILTER]
  };
  const result = await (parent ? dialog.showOpenDialog(parent, opts) : dialog.showOpenDialog(opts));
  return result.canceled ? [] : result.filePaths;
}

async function pickFolder(parent: BrowserWindow | null): Promise<string | null> {
  const opts: Electron.OpenDialogOptions = { properties: ['openDirectory'] };
  const result = await (parent ? dialog.showOpenDialog(parent, opts) : dialog.showOpenDialog(opts));
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0]!;
}

function buildTemplate(): MenuItemConstructorOptions[] {
  const macAppMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      // PRD-010 FR-01/02: macOS HIG — 설정은 앱 메뉴 안. Cmd+, 표준.
      {
        label: '설정...',
        accelerator: 'CmdOrCtrl+,',
        click: () => sendMenuCommand('open-settings')
      },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  };

  const fileMenu: MenuItemConstructorOptions = {
    label: '파일',
    submenu: [
      {
        label: '열기...',
        accelerator: 'CmdOrCtrl+O',
        click: async (_item, win) => {
          const parent = (win as BrowserWindow | undefined) ?? targetWindow();
          const files = await pickFiles(parent);
          sendFilesOpened(files);
        }
      },
      {
        label: '폴더 열기...',
        accelerator: 'CmdOrCtrl+Shift+O',
        click: async (_item, win) => {
          const parent = (win as BrowserWindow | undefined) ?? targetWindow();
          const folder = await pickFolder(parent);
          if (!folder) return;
          const files = await listMarkdownFiles(folder);
          sendFilesOpened(files);
        }
      },
      { type: 'separator' },
      {
        label: '다이어그램 저장 (SVG 일괄)',
        click: () => sendMenuCommand('save-all-diagrams')
      },
      {
        label: '다이어그램 저장 (PNG 일괄)',
        click: () => sendMenuCommand('save-all-diagrams-png')
      },
      {
        label: 'PDF 로 내보내기...',
        accelerator: 'CmdOrCtrl+P',
        click: () => sendMenuCommand('export-pdf')
      },
      { type: 'separator' },
      {
        label: '탭 닫기',
        accelerator: 'CmdOrCtrl+W',
        click: () => sendMenuCommand('close-tab')
      },
      // PRD-010 FR-01: macOS 가 아니면 파일 메뉴 끝에 설정 항목 (Cmd+, 단축키는 macAppMenu 와 중복 X — isMac 분기).
      ...(isMac
        ? []
        : ([
            { type: 'separator' },
            {
              label: '설정...',
              accelerator: 'CmdOrCtrl+,',
              click: () => sendMenuCommand('open-settings')
            }
          ] as MenuItemConstructorOptions[])),
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  };

  const editMenu: MenuItemConstructorOptions = {
    label: '편집',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: '보기',
    submenu: [
      {
        label: '검색...',
        accelerator: 'CmdOrCtrl+F',
        click: () => sendMenuCommand('open-search')
      },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: '창',
    submenu: isMac
      ? [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' }
        ]
      : [{ role: 'minimize' }, { role: 'close' }]
  };

  return [
    ...(isMac ? [macAppMenu] : []),
    fileMenu,
    editMenu,
    viewMenu,
    windowMenu
  ];
}

export function installMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildTemplate()));
}
