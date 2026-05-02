import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { getStrictWebPreferences } from './security';
import { isAllowedInternalUrl, isExternalHttpUrl } from './url';
import { ConfigStore } from './config';
import { registerAllIpc } from './ipc';
import { installMenu } from './menu';

const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL'];

// productName 을 명시 — app.getPath('userData') 가 'Diagrade' 디렉터리를 사용 (FR-41).
app.setName('Diagrade');

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: false,
    webPreferences: getStrictWebPreferences(join(__dirname, '../preload/index.js'))
  });

  win.once('ready-to-show', () => win.show());

  // SEC-05: 외부 링크는 OS 기본 브라우저로 위임. 새 창 생성 자체는 거부.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // SEC-05: 앱 창 내부 임의 navigate 차단. 외부 URL 은 외부 브라우저로.
  win.webContents.on('will-navigate', (event, url) => {
    if (isAllowedInternalUrl(url)) return;
    event.preventDefault();
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url);
    }
  });

  if (RENDERER_DEV_URL) {
    void win.loadURL(RENDERER_DEV_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

void app.whenReady().then(() => {
  // Config: app.getPath('userData') 의 표준 위치 (FR-41).
  const configStore = new ConfigStore(join(app.getPath('userData'), 'config.json'));
  registerAllIpc(configStore);
  installMenu();

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
