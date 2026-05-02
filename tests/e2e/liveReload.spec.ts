import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';

const MAIN_PATH = resolve(__dirname, '../../out/main/index.js');

let app: ElectronApplication;
let win: Page;
let tmpDir: string;
let userDataDir: string;

async function pushFiles(app: ElectronApplication, paths: string[]): Promise<void> {
  await app.evaluate(async ({ BrowserWindow }, payload) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (!w) throw new Error('no window');
    w.webContents.send('app:files-opened', payload);
  }, paths);
}

test.beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-e2e-lr-'));
  userDataDir = mkdtempSync(join(tmpdir(), 'diagrade-e2e-userdata-'));
  // userData 격리 — 사용자 실제 config 파일에 영향 X.
  app = await electron.launch({
    args: [MAIN_PATH],
    env: { ...process.env, DIAGRADE_USER_DATA: userDataDir }
  });
  win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
});

test.afterEach(async () => {
  await app.close();
  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(userDataDir, { recursive: true, force: true });
});

test('FR-01: 파일 변경 자동 감지 → 본문 갱신', async () => {
  const file = join(tmpDir, 'note.md');
  writeFileSync(file, '# 첫 번째 헤딩\n', 'utf-8');

  await pushFiles(app, [file]);
  await expect(win.locator('h1')).toContainText('첫 번째 헤딩');

  // 외부 에디터처럼 파일 변경.
  writeFileSync(file, '# 두 번째 헤딩\n', 'utf-8');

  // chokidar atomic 300 + debounce 250 + 약간의 여유.
  await expect(win.locator('h1')).toContainText('두 번째 헤딩', { timeout: 3000 });
});

test('FR-04: 자동 갱신 시 scrollTop 보존', async () => {
  const longLines = Array.from({ length: 80 }, (_, i) => `## 헤딩 ${i + 1}\n\n본문 줄 ${i + 1}\n`);
  const file = join(tmpDir, 'long.md');
  writeFileSync(file, longLines.join('\n'), 'utf-8');

  await pushFiles(app, [file]);
  await expect(win.locator('h2').first()).toContainText('헤딩 1');

  // 중간으로 스크롤.
  const targetScroll = await win.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return 0;
    main.scrollTop = 1500;
    return main.scrollTop;
  });
  expect(targetScroll).toBeGreaterThan(0);

  // 끝부분만 살짝 변경 — 스크롤 위치가 영향받지 않아야 함.
  writeFileSync(file, longLines.join('\n') + '\n\n## 추가 헤딩\n', 'utf-8');

  // 갱신 대기.
  await expect(win.locator('h2').last()).toContainText('추가 헤딩', { timeout: 3000 });

  // scrollTop 이 거의 그대로.
  const afterScroll = await win.evaluate(
    () => document.querySelector('main')?.scrollTop ?? 0
  );
  // 정확 같은 값을 기대하긴 어렵지만 (layout 미세 변동), 변동 폭이 작아야 함.
  expect(Math.abs(afterScroll - targetScroll)).toBeLessThan(50);
});

test('FR-12: liveReload: false 일 때 파일 변경에 무반응', async () => {
  // config:set 으로 비활성화.
  await win.evaluate(async () => {
    await window.diagrade.config.set({ liveReload: false });
  });

  const file = join(tmpDir, 'note.md');
  writeFileSync(file, '# 원본\n', 'utf-8');
  await pushFiles(app, [file]);
  await expect(win.locator('h1')).toContainText('원본');

  // 파일 변경.
  writeFileSync(file, '# 변경됨\n', 'utf-8');

  // 충분히 대기 후에도 갱신 X.
  await win.waitForTimeout(1000);
  await expect(win.locator('h1')).toContainText('원본');
  await expect(win.locator('h1')).not.toContainText('변경됨');
});

test('FR-08: 파일 삭제 시 본문 유지 + 토스트', async () => {
  const file = join(tmpDir, 'will-delete.md');
  writeFileSync(file, '# 사라질 문서\n\n본문\n', 'utf-8');
  await pushFiles(app, [file]);
  await expect(win.locator('h1')).toContainText('사라질 문서');

  unlinkSync(file);

  // atomic 300 + 약간의 여유 후 토스트 표시.
  await expect(win.getByRole('status')).toContainText('파일이 삭제되었습니다', { timeout: 3000 });
  // 본문은 그대로.
  await expect(win.locator('h1')).toContainText('사라질 문서');
});

test('FR-05: 활성 탭 전환 시 watcher 가 새 path 로 전환', async () => {
  const fileA = join(tmpDir, 'a.md');
  const fileB = join(tmpDir, 'b.md');
  writeFileSync(fileA, '# A 의 헤딩\n', 'utf-8');
  writeFileSync(fileB, '# B 의 헤딩\n', 'utf-8');

  await pushFiles(app, [fileA, fileB]);
  // B 가 마지막에 열려 활성.
  await expect(win.locator('h1')).toContainText('B 의 헤딩');

  // A 변경 — B 가 활성이므로 B 의 본문에 영향 X.
  writeFileSync(fileA, '# A 변경\n', 'utf-8');
  await win.waitForTimeout(800);
  await expect(win.locator('h1')).toContainText('B 의 헤딩');
  await expect(win.locator('h1')).not.toContainText('A 변경');

  // B 변경 — 활성이므로 갱신.
  writeFileSync(fileB, '# B 변경됨\n', 'utf-8');
  await expect(win.locator('h1')).toContainText('B 변경됨', { timeout: 3000 });
});
