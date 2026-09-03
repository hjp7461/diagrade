import { app, BrowserWindow, shell, protocol } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getStrictWebPreferences } from './security';
import { isAllowedInternalUrl, isExternalHttpUrl } from './url';
import { ConfigStore } from './config';
import { registerAllIpc } from './ipc';
import { installMenu, sendFilesOpened } from './menu';
import { registerImageProtocol, IMAGE_PROTOCOL_PRIVILEGES } from './protocol';
import { addPendingFiles, markdownPathsFromArgv, registerPendingFilesIpc } from './openFiles';

const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL'];

/**
 * BrowserWindow icon path 결정.
 *
 * - 패키지된 앱: extraResources 로 복사된 process.resourcesPath/icon.png.
 * - 개발 (npm run dev): repo 루트의 assets/icon.png. __dirname 은 out/main/ 이므로 ../../assets.
 *
 * 둘 다 없으면 undefined 반환 → Electron 기본 아이콘 사용 (사용자가 assets/icon.png 를 지웠을 때
 * 안전하게 폴백).
 */
function resolveAppIconPath(): string | undefined {
  const candidates = [
    join(process.resourcesPath ?? '', 'icon.png'),
    join(__dirname, '..', '..', 'assets', 'icon.png')
  ];
  return candidates.find((p) => p && existsSync(p));
}

// 커스텀 스킴은 app.ready 이전에 등록되어야 한다 (Electron 요구).
protocol.registerSchemesAsPrivileged([IMAGE_PROTOCOL_PRIVILEGES]);

// productName 을 명시 — app.getPath('userData') 가 'Diagrade' 디렉터리를 사용 (FR-41).
app.setName('Diagrade');

// 테스트 격리용 escape hatch — DIAGRADE_USER_DATA 가 설정되면 그 경로를 userData 로 사용.
// 사용자 환경에선 미설정이라 영향 없음.
const userDataOverride = process.env['DIAGRADE_USER_DATA'];
if (userDataOverride) {
  app.setPath('userData', userDataOverride);
}

function createMainWindow(): BrowserWindow {
  const iconPath = resolveAppIconPath();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: false,
    ...(iconPath ? { icon: iconPath } : {}),
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

/**
 * OS 파일 연결 ③ (macOS) — Finder 의 "다음으로 열기" 는 argv 가 아니라 open-file 이벤트로
 * 온다. app.ready 이전에도 발생하므로 반드시 top-level 에서 구독한다.
 */
app.on('open-file', (event, path) => {
  event.preventDefault();
  if (BrowserWindow.getAllWindows().length > 0) sendFilesOpened([path]);
  else addPendingFiles([path]);
});

// OS 파일 연결 ① (Windows/Linux) — 콜드 스타트 argv. 창이 뜨기 전이라 버퍼로 넘긴다.
addPendingFiles(markdownPathsFromArgv(process.argv));

/**
 * 탐색기에서 파일을 또 열었을 때 앱이 통째로 하나 더 뜨지 않도록 단일 인스턴스로 고정.
 * 락을 못 얻은 두 번째 프로세스는 즉시 종료하고, 경로는 second-instance 로 첫 프로세스에 전달.
 */
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', (_event, argv) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
  // OS 파일 연결 ② — 창이 이미 살아있으므로 push.
  sendFilesOpened(markdownPathsFromArgv(argv));
});

let watcherRef: ReturnType<typeof registerAllIpc>['watcher'] | null = null;

void app.whenReady().then(() => {
  // 락을 못 얻은 프로세스는 창을 만들지 않는다 (app.quit() 이 완료되기 전에 ready 가 올 수 있음).
  if (!hasSingleInstanceLock) return;

  // Config: app.getPath('userData') 의 표준 위치 (FR-41).
  const configStore = new ConfigStore(join(app.getPath('userData'), 'config.json'));
  const { watcher } = registerAllIpc(configStore);
  watcherRef = watcher;
  registerImageProtocol();
  registerPendingFilesIpc();
  installMenu();

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// PRD-002 FR-06: 앱 종료 시 watcher 자원 해제.
app.on('before-quit', () => {
  watcherRef?.stop();
  watcherRef = null;
});
