import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import type { ElectronApplication } from '@playwright/test';

const MAIN_PATH = resolve(__dirname, '../../out/main/index.js');

let app: ElectronApplication;

test.beforeEach(async () => {
  app = await electron.launch({ args: [MAIN_PATH] });
});

test.afterEach(async () => {
  await app.close();
});

test('앱 실행 + 첫 창 표시', async () => {
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await expect(win).toHaveTitle(/Diagrade/);
});

test('SEC-02: window.diagrade 만 노출되고 require 는 차단', async () => {
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const apiType = await win.evaluate(() => typeof (window as { diagrade?: unknown }).diagrade);
  expect(apiType).toBe('object');

  // SEC-01: nodeIntegration false → require 가 노출되지 않아야 한다.
  const requireType = await win.evaluate(
    () => typeof (globalThis as { require?: unknown }).require
  );
  expect(requireType).toBe('undefined');

  // process 도 노출 안 됨.
  const processType = await win.evaluate(
    () => typeof (globalThis as { process?: unknown }).process
  );
  expect(processType).toBe('undefined');
});

test('SEC-07: CSP 메타 태그가 박혀있다', async () => {
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const csp = await win.evaluate(() => {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return meta?.getAttribute('content') ?? null;
  });
  expect(csp).not.toBeNull();
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain('diagrade-asset:');
});

test('preload API surface — 필수 채널이 모두 노출됨', async () => {
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const surface = await win.evaluate(() => {
    const api = (window as { diagrade?: Record<string, unknown> }).diagrade;
    if (!api) return null;
    const get = (key: string, sub: string) =>
      typeof (api[key] as Record<string, unknown> | undefined)?.[sub];
    return {
      version: typeof api.version,
      dialogOpen: get('dialog', 'openFile'),
      dialogSave: get('dialog', 'saveFile'),
      fsRead: get('fs', 'readText'),
      fsWriteText: get('fs', 'writeText'),
      fsWriteBinary: get('fs', 'writeBinary'),
      configGet: get('config', 'get'),
      protocolReg: get('protocol', 'registerTabDir'),
      printPdf: get('print', 'pdf'),
      onFiles: get('events', 'onFilesOpened'),
      appTakePending: get('app', 'takePendingFiles'),
      // PRD-002 신규
      watchSetActive: get('watch', 'setActivePath'),
      onFileChanged: get('events', 'onFileChanged'),
      onFileMissing: get('events', 'onFileMissing')
    };
  });

  expect(surface).toEqual({
    version: 'string',
    dialogOpen: 'function',
    dialogSave: 'function',
    fsRead: 'function',
    fsWriteText: 'function',
    fsWriteBinary: 'function',
    configGet: 'function',
    protocolReg: 'function',
    printPdf: 'function',
    onFiles: 'function',
    appTakePending: 'function',
    watchSetActive: 'function',
    onFileChanged: 'function',
    onFileMissing: 'function'
  });
});
