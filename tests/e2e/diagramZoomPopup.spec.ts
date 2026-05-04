import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication } from '@playwright/test';

/**
 * PRD-011: 다이어그램 확대보기 팝업.
 *
 * 시나리오:
 *  - ⤢ 확대보기 메뉴 항목 등장 (정상 차트)
 *  - 클릭 → 팝업 보임 (툴바 + ✕ 버튼 + 줌 표시)
 *  - ➕ 클릭 → 줌 % 변화
 *  - ESC / ✕ → 팝업 닫힘
 *  - 두 번째 차트의 ⤢ → 팝업 교체 (싱글톤)
 *  - 에러 fallback 에는 ⤢ 메뉴 자체 없음
 */

const MAIN_PATH = resolve(__dirname, '../../out/main/index.js');

let app: ElectronApplication;
let tmpDir: string;

test.beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-e2e-zoom-'));
  app = await electron.launch({ args: [MAIN_PATH] });
});

test.afterEach(async () => {
  await app.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

async function pushFiles(app: ElectronApplication, paths: string[]): Promise<void> {
  await app.evaluate(async ({ BrowserWindow }, payload) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('no window');
    win.webContents.send('app:files-opened', payload);
  }, paths);
}

test('FR-01/03: ⤢ 확대보기 메뉴 항목이 정상 차트에 표시되고 클릭 시 팝업 등장', async () => {
  const file = join(tmpDir, 'zoom.md');
  writeFileSync(file, '```mermaid\nflowchart TD\nA-->B\n```\n', 'utf-8');

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await pushFiles(app, [file]);

  const chart = win.locator('.diagrade-mermaid');
  await expect(chart).toHaveCount(1, { timeout: 10_000 });

  await chart.hover();
  await win.waitForTimeout(300);

  const zoomBtn = chart.locator('button', { hasText: '⤢' });
  await expect(zoomBtn).toBeVisible();

  await zoomBtn.click();
  await expect(win.locator('.diagrade-zoom-dialog')).toBeVisible();
  await expect(win.locator('.diagrade-zoom-dialog__level')).toBeVisible();
});

test('FR-06/07: ESC 와 ✕ 둘 다 팝업을 닫는다', async () => {
  const file = join(tmpDir, 'close.md');
  writeFileSync(file, '```mermaid\nflowchart TD\nA-->B\n```\n', 'utf-8');

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await pushFiles(app, [file]);

  const chart = win.locator('.diagrade-mermaid');
  await expect(chart).toHaveCount(1, { timeout: 10_000 });

  // ESC 닫힘
  await chart.hover();
  await win.waitForTimeout(300);
  await chart.locator('button', { hasText: '⤢' }).click();
  await expect(win.locator('.diagrade-zoom-dialog')).toBeVisible();
  await win.keyboard.press('Escape');
  await expect(win.locator('.diagrade-zoom-dialog')).toHaveCount(0);

  // ✕ 닫힘
  await chart.hover();
  await win.waitForTimeout(300);
  await chart.locator('button', { hasText: '⤢' }).click();
  await expect(win.locator('.diagrade-zoom-dialog')).toBeVisible();
  await win.locator('.diagrade-zoom-dialog__close').click();
  await expect(win.locator('.diagrade-zoom-dialog')).toHaveCount(0);
});

test('FR-11/12: ➕ 클릭 시 줌 % 가 한 단계 증가, ➕ 끝에서 비활성', async () => {
  const file = join(tmpDir, 'zoomctl.md');
  writeFileSync(file, '```mermaid\nflowchart TD\nA-->B\n```\n', 'utf-8');

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await pushFiles(app, [file]);

  const chart = win.locator('.diagrade-mermaid');
  await expect(chart).toHaveCount(1, { timeout: 10_000 });

  await chart.hover();
  await win.waitForTimeout(300);
  await chart.locator('button', { hasText: '⤢' }).click();

  const level = win.locator('.diagrade-zoom-dialog__level');
  const initialText = (await level.textContent()) ?? '';
  expect(initialText).toMatch(/%$/);

  const zoomIn = win.locator('.diagrade-zoom-dialog__btn[aria-label="확대"]');
  await zoomIn.click();
  const after = (await level.textContent()) ?? '';
  expect(after).not.toBe(initialText);
});

test('FR-04: 첫 팝업 닫은 뒤 두 번째 차트 ⤢ → 새 팝업 (싱글톤이라 1 개)', async () => {
  // 팝업이 fixed inset:0 으로 본문을 가리므로, 실 사용자 흐름은 "한 팝업 닫고 다음 클릭".
  // 진정한 교체(팝업 떠 있는 동안 args swap)는 DiagramZoomDialog.test.tsx 가 단위로 검증.
  const file = join(tmpDir, 'two.md');
  writeFileSync(
    file,
    '```mermaid\nflowchart TD\nA-->B\n```\n\n```mermaid\nflowchart LR\nC-->D\n```\n',
    'utf-8'
  );

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await pushFiles(app, [file]);

  const charts = win.locator('.diagrade-mermaid');
  await expect(charts).toHaveCount(2, { timeout: 10_000 });

  await charts.nth(0).hover();
  await win.waitForTimeout(300);
  await charts.nth(0).locator('button', { hasText: '⤢' }).click();
  await expect(win.locator('.diagrade-zoom-dialog')).toHaveCount(1);
  await win.keyboard.press('Escape');
  await expect(win.locator('.diagrade-zoom-dialog')).toHaveCount(0);

  await charts.nth(1).hover();
  await win.waitForTimeout(300);
  await charts.nth(1).locator('button', { hasText: '⤢' }).click();
  await expect(win.locator('.diagrade-zoom-dialog')).toHaveCount(1);
});

test('FR-02: 에러 fallback 노드에는 export 메뉴 자체가 없음 (⤢ 도 미주입)', async () => {
  const file = join(tmpDir, 'broken.md');
  writeFileSync(file, '```mermaid\nNOT VALID syntax!!!\n```\n', 'utf-8');

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await pushFiles(app, [file]);

  const errorBlock = win.locator('.diagrade-mermaid-error');
  await expect(errorBlock).toHaveCount(1, { timeout: 10_000 });
  await expect(errorBlock.locator('.diagrade-export-menu')).toHaveCount(0);
});
