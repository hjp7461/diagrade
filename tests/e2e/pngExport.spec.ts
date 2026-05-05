import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication } from '@playwright/test';

/**
 * PRD-016 (PR #17, 10cee5b) + fix PR #18 (d9dd3f8) 의 회귀 가드.
 *
 * jsdom 환경의 vitest 단위 테스트로는 `<img src=>` 의 CSP 강제 / canvas drawImage /
 * toDataURL 본체가 검증 불가하다. 본 e2e 는 실제 Electron + Chromium 에서:
 *
 *   1. 단일 ⬇ PNG 클릭이 디스크에 정상 PNG 시그니처 (89 50 4E 47) 를 떨어뜨리는지.
 *   2. 일괄 PNG 저장이 모든 차트를 디스크에 정상 PNG 로 떨어뜨리는지.
 *   3. CSP `img-src` 위반 ("Refused to load the image 'blob:...'") 콘솔 에러가
 *      재발하지 않는지 — fix PR #18 의 핵심 회귀.
 */

const MAIN_PATH = resolve(__dirname, '../../out/main/index.js');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let app: ElectronApplication;
let tmpDir: string;

test.beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-e2e-png-'));
  app = await electron.launch({ args: [MAIN_PATH] });
});

test.afterEach(async () => {
  await app.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

async function pushFiles(paths: string[]): Promise<void> {
  await app.evaluate(({ BrowserWindow }, payload) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('no window');
    win.webContents.send('app:files-opened', payload);
  }, paths);
}

async function sendMenuCommand(command: string): Promise<void> {
  await app.evaluate(({ BrowserWindow }, cmd) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('no window');
    win.webContents.send('app:menu-command', cmd);
  }, command);
}

/**
 * dialog.showSaveDialog 를 main 프로세스에서 monkey-patch.
 * 호출마다 nextPaths 의 head 를 반환 (일괄 저장 시 차트별로 다른 path).
 * head 가 빠지면 cancel 동작.
 */
async function stubSaveDialog(filePaths: string[]): Promise<void> {
  await app.evaluate(({ dialog }, paths) => {
    let i = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dialog as any).showSaveDialog = async () => {
      const next = paths[i++];
      if (next === undefined) return { canceled: true, filePath: undefined };
      return { canceled: false, filePath: next };
    };
  }, filePaths);
}

test('PRD-016 회귀: 단일 ⬇ PNG → 디스크에 정상 PNG signature 파일', async () => {
  const mdFile = join(tmpDir, 'note.md');
  writeFileSync(
    mdFile,
    '# 차트\n\n```mermaid\nflowchart TD\nA[Start] --> B[End]\n```\n',
    'utf-8'
  );
  const pngTarget = join(tmpDir, 'note-1.png');

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  // CSP 회귀를 잡기 위해 페이지 콘솔 에러 capture.
  const consoleErrors: string[] = [];
  win.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await stubSaveDialog([pngTarget]);
  await pushFiles([mdFile]);

  const chart = win.locator('.diagrade-mermaid');
  await expect(chart).toHaveCount(1, { timeout: 10_000 });
  await expect(chart.locator('svg')).toBeVisible();

  // 메뉴는 호버 시에만 visible (CSS opacity + pointer-events). 사용자 흐름과 동등.
  await chart.hover();
  const menu = chart.locator('.diagrade-export-menu');
  await expect(menu).toBeVisible();
  await menu.locator('button', { hasText: 'PNG' }).click();

  await expect
    .poll(() => existsSync(pngTarget), { timeout: 10_000 })
    .toBe(true);

  const bytes = readFileSync(pngTarget);
  expect(bytes.length).toBeGreaterThan(PNG_SIGNATURE.length);
  expect(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);

  // CSP 회귀 가드: blob: img-src 위반 메시지가 다시 찍히면 안 됨.
  const cspViolations = consoleErrors.filter(
    (e) => e.includes('Refused to load') || e.includes("img-src")
  );
  expect(cspViolations).toEqual([]);
});

test('PRD-008 + PRD-016 회귀: 일괄 PNG 저장 → 다중 mermaid 모두 정상 PNG', async () => {
  const mdFile = join(tmpDir, 'multi.md');
  writeFileSync(
    mdFile,
    [
      '# 다중 차트',
      '',
      '```mermaid',
      'flowchart TD',
      'A --> B',
      '```',
      '',
      '```mermaid',
      'sequenceDiagram',
      'Alice->>Bob: hello',
      '```',
      ''
    ].join('\n'),
    'utf-8'
  );

  const pngTargets = [join(tmpDir, 'multi-1.png'), join(tmpDir, 'multi-2.png')];

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const consoleErrors: string[] = [];
  win.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await stubSaveDialog(pngTargets);
  await pushFiles([mdFile]);

  // 두 차트 렌더 완료 대기.
  await expect(win.locator('.diagrade-mermaid')).toHaveCount(2, { timeout: 10_000 });

  // 일괄 PNG 메뉴 명령 emit. MarkdownView 가 saveAllDiagrams 호출.
  await sendMenuCommand('save-all-diagrams-png');

  for (const target of pngTargets) {
    await expect.poll(() => existsSync(target), { timeout: 15_000 }).toBe(true);
    const bytes = readFileSync(target);
    expect(bytes.length).toBeGreaterThan(PNG_SIGNATURE.length);
    expect(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);
  }

  const cspViolations = consoleErrors.filter(
    (e) => e.includes('Refused to load') || e.includes("img-src")
  );
  expect(cspViolations).toEqual([]);
});
