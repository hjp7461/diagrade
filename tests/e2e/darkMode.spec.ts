import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';

const MAIN_PATH = resolve(__dirname, '../../out/main/index.js');
const DARK_CLASS = 'diagrade-theme-dark';

let app: ElectronApplication;
let win: Page;
let userDataDir: string;

async function launchWith(opts?: { configBeforeLaunch?: object }): Promise<void> {
  userDataDir = mkdtempSync(join(tmpdir(), 'diagrade-e2e-theme-'));
  if (opts?.configBeforeLaunch) {
    writeFileSync(
      join(userDataDir, 'config.json'),
      JSON.stringify(opts.configBeforeLaunch),
      'utf-8'
    );
  }
  app = await electron.launch({
    args: [MAIN_PATH],
    env: { ...process.env, DIAGRADE_USER_DATA: userDataDir }
  });
  win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
}

test.afterEach(async () => {
  await app.close();
  rmSync(userDataDir, { recursive: true, force: true });
});

test('FR-02: theme=auto + 시스템 dark → body 에 .diagrade-theme-dark', async () => {
  await launchWith();
  // light → dark 명시 전환 — 일부 환경에서 emulate 의 첫 호출이 change 이벤트를
  // 안 날리는 경우가 있어 light 부터 시작하는 패턴을 따름 (FR-04 와 동일).
  await win.emulateMedia({ colorScheme: 'light' });
  await win.emulateMedia({ colorScheme: 'dark' });

  await win.waitForFunction(
    (cls) => document.body.classList.contains(cls),
    DARK_CLASS,
    { timeout: 2000 }
  );
});

test('FR-02: theme=auto + 시스템 light → body 에 클래스 없음', async () => {
  await launchWith();
  await win.emulateMedia({ colorScheme: 'light' });
  await win.waitForTimeout(100);

  const hasClass = await win.evaluate(
    (cls) => document.body.classList.contains(cls),
    DARK_CLASS
  );
  expect(hasClass).toBe(false);
});

test('FR-04: 시스템 light→dark 동적 전환 → body 클래스 자동 추가', async () => {
  await launchWith();
  await win.emulateMedia({ colorScheme: 'light' });
  await win.waitForTimeout(100);
  expect(
    await win.evaluate((c) => document.body.classList.contains(c), DARK_CLASS)
  ).toBe(false);

  await win.emulateMedia({ colorScheme: 'dark' });
  await win.waitForTimeout(200); // matchMedia change 이벤트 + react 적용

  expect(
    await win.evaluate((c) => document.body.classList.contains(c), DARK_CLASS)
  ).toBe(true);
});

test('FR-03: theme="dark" 강제 → 시스템 light 여도 dark', async () => {
  await launchWith({
    configBeforeLaunch: { maxTabs: 20, liveReload: true, theme: 'dark' }
  });
  // config.theme='dark' 라 시스템과 무관하게 dark
  await win.emulateMedia({ colorScheme: 'light' });
  await win.waitForTimeout(200); // config 로드 + useTheme 효과

  const hasClass = await win.evaluate(
    (cls) => document.body.classList.contains(cls),
    DARK_CLASS
  );
  expect(hasClass).toBe(true);
});

test('FR-03: theme="light" 강제 → 시스템 dark 여도 light', async () => {
  await launchWith({
    configBeforeLaunch: { maxTabs: 20, liveReload: true, theme: 'light' }
  });
  await win.emulateMedia({ colorScheme: 'dark' });
  await win.waitForTimeout(200);

  const hasClass = await win.evaluate(
    (cls) => document.body.classList.contains(cls),
    DARK_CLASS
  );
  expect(hasClass).toBe(false);
});

test('FR-06: theme 잘못된 값 → default auto 폴백 (시스템 dark 면 dark)', async () => {
  await launchWith({
    configBeforeLaunch: {
      maxTabs: 20,
      liveReload: true,
      theme: 'pink'
    }
  });
  await win.emulateMedia({ colorScheme: 'light' });
  await win.emulateMedia({ colorScheme: 'dark' });

  // 'pink' 가 거부되고 default 'auto' 적용 → 시스템 dark 라 body 에 dark 클래스
  await win.waitForFunction(
    (cls) => document.body.classList.contains(cls),
    DARK_CLASS,
    { timeout: 2000 }
  );
});
