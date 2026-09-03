import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { ElectronApplication } from '@playwright/test';

const MAIN_PATH = resolve(__dirname, '../../out/main/index.js');

/**
 * OS 파일 연결 (탐색기 우클릭 "연결 프로그램" / Finder "다음으로 열기") 회귀 가드.
 *
 * 탐색기가 파일을 넘기는 방식은 결국 "argv 에 경로를 붙여 앱을 실행" 이므로,
 * MAIN_PATH 뒤에 .md 경로를 붙여 실행하는 것으로 실제 경로를 재현할 수 있다.
 *
 * 이 테스트가 막는 회귀: main 이 경로를 창 생성 직후 send 하면 렌더러가 아직
 * onFilesOpened 를 구독하기 전이라 유실된다 (= 더블클릭했는데 빈 창). pull 방식
 * (app:take-pending-files) 이 유지되는지 검증한다.
 */
let app: ElectronApplication;
let tmpDir: string;
let userDataDir: string;

test.beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-e2e-openwith-'));
  userDataDir = mkdtempSync(join(tmpdir(), 'diagrade-e2e-userdata-'));
});

test.afterEach(async () => {
  await app.close();
  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(userDataDir, { recursive: true, force: true });
});

async function launch(extraArgs: string[]): Promise<ElectronApplication> {
  return electron.launch({
    args: [MAIN_PATH, ...extraArgs],
    env: { ...process.env, DIAGRADE_USER_DATA: userDataDir }
  });
}

test('argv 로 넘어온 .md 가 첫 창에 열린다', async () => {
  const file = join(tmpDir, 'from-explorer.md');
  writeFileSync(file, '# 탐색기에서 열림\n', 'utf-8');

  app = await launch([file]);
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  await expect(win.locator('h1')).toContainText('탐색기에서 열림');
});

test('.md 가 아닌 argv 는 무시하고 빈 상태로 뜬다', async () => {
  const file = join(tmpDir, 'not-markdown.txt');
  writeFileSync(file, 'plain text\n', 'utf-8');

  app = await launch([file]);
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  // 탭이 하나도 열리지 않고 빈 상태 화면이 유지돼야 한다.
  await expect(win.getByRole('tab')).toHaveCount(0);
  await expect(win.locator('.diagrade-empty-state')).toBeVisible();
});

test('여러 .md 를 한 번에 넘기면 모두 열린다', async () => {
  const a = join(tmpDir, 'a.md');
  const b = join(tmpDir, 'b.md');
  writeFileSync(a, '# 문서 A\n', 'utf-8');
  writeFileSync(b, '# 문서 B\n', 'utf-8');

  app = await launch([a, b]);
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  // 활성 탭은 마지막 파일. 탭바에 두 개가 모두 있어야 한다.
  await expect(win.getByRole('tab')).toHaveCount(2);
});
