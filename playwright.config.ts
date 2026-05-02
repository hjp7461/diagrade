import { defineConfig } from '@playwright/test';

/**
 * Playwright 설정. M8.
 *
 * - testDir 는 tests/e2e — Vitest 의 tests/unit 과 분리.
 * - fullyParallel: false — Electron 앱 인스턴스가 직렬 실행되어야 안정.
 * - 빌드 산출물 (out/) 에 의존하므로, npm run test:e2e 는 build 후 실행.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure'
  }
});
