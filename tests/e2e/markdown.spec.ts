import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication } from '@playwright/test';

const MAIN_PATH = resolve(__dirname, '../../out/main/index.js');

let app: ElectronApplication;
let tmpDir: string;

test.beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-e2e-md-'));
  app = await electron.launch({ args: [MAIN_PATH] });
});

test.afterEach(async () => {
  await app.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

async function pushFiles(app: ElectronApplication, paths: string[]): Promise<void> {
  // Main process 에서 직접 'app:files-opened' 발사 — 메뉴 / 다이얼로그 우회.
  await app.evaluate(async ({ BrowserWindow }, payload) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('no window');
    win.webContents.send('app:files-opened', payload);
  }, paths);
}

test('마크다운 파일을 열면 본문이 렌더된다 (FR-01/02)', async () => {
  const file = join(tmpDir, 'note.md');
  writeFileSync(file, '# 테스트 헤딩\n\n본문 한 줄.\n\n- a\n- b\n', 'utf-8');

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  await pushFiles(app, [file]);

  await expect(win.locator('h1')).toContainText('테스트 헤딩');
  await expect(win.locator('.diagrade-markdown')).toContainText('본문 한 줄');
  await expect(win.locator('.diagrade-markdown ul li').first()).toContainText('a');
});

test('Mermaid 다이어그램이 SVG 로 렌더된다 (FR-06)', async () => {
  const file = join(tmpDir, 'diagram.md');
  writeFileSync(
    file,
    '# 차트\n\n```mermaid\nflowchart TD\nA[Start] --> B[End]\n```\n',
    'utf-8'
  );

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  await pushFiles(app, [file]);

  // jsdom 에선 mermaid 가 못 돌지만 실 Chromium 에선 됨.
  // .diagrade-mermaid 컨테이너 (정상 렌더) 가 만들어지는지 확인.
  const chart = win.locator('.diagrade-mermaid');
  await expect(chart).toHaveCount(1, { timeout: 10_000 });

  // 안에 SVG 가 있어야 함.
  await expect(chart.locator('svg')).toBeVisible();
});

test('FR-21: mermaid 컨테이너 호버 시 export 메뉴 등장', async () => {
  const file = join(tmpDir, 'hover.md');
  writeFileSync(file, '```mermaid\nflowchart TD\nA-->B\n```\n', 'utf-8');

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  await pushFiles(app, [file]);

  const chart = win.locator('.diagrade-mermaid');
  await expect(chart).toHaveCount(1, { timeout: 10_000 });

  // 메뉴 자체는 DOM 에 항상 존재 (CSS opacity 로 숨김). 호버 시 보이게 됨.
  const menu = chart.locator('.diagrade-export-menu');
  await expect(menu).toBeAttached();

  await chart.hover();
  // CSS transition 대기.
  await win.waitForTimeout(300);
  await expect(menu).toBeVisible();

  // PNG / SVG 두 버튼 확인.
  await expect(menu.locator('button')).toHaveCount(2);
});

test('FR-08: 잘못된 mermaid 코드는 에러 fallback 으로 표시', async () => {
  const file = join(tmpDir, 'broken.md');
  writeFileSync(
    file,
    '```mermaid\nthis is not valid mermaid syntax!!!\n```\n',
    'utf-8'
  );

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  await pushFiles(app, [file]);

  // 에러 fallback 컨테이너 등장.
  const errorBlock = win.locator('.diagrade-mermaid-error');
  await expect(errorBlock).toHaveCount(1, { timeout: 10_000 });

  // FR-28: 에러 fallback 에 export 메뉴가 주입되지 않음.
  await expect(errorBlock.locator('.diagrade-export-menu')).toHaveCount(0);

  // 원본 코드가 표시되어야 함.
  await expect(errorBlock).toContainText('not valid mermaid');
});

test('FR-19: 동일 파일 두 번 열기 — 새 탭이 안 생기고 기존 탭으로 포커스', async () => {
  const file = join(tmpDir, 'same.md');
  writeFileSync(file, '# 같은 파일\n', 'utf-8');

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  await pushFiles(app, [file]);
  await pushFiles(app, [file]);

  // 같은 파일을 두 번 열었지만 탭은 1 개 (기존으로 포커스).
  await expect(win.getByRole('tab')).toHaveCount(1);
});
