/**
 * Navigation guard helpers (PRD-001 §SEC-05).
 *
 * 별도 파일로 분리한 이유: src/main/index.ts 는 top-level 에서
 * `app.whenReady()` 를 호출하므로 import 하는 즉시 Electron 런타임이 필요해진다.
 * 헬퍼만 분리하면 vitest+jsdom 환경에서 그대로 import 해서 단위 테스트할 수 있다.
 */

export function isExternalHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function isAllowedInternalUrl(url: string): boolean {
  return (
    url.startsWith('http://localhost') ||
    url.startsWith('http://127.0.0.1') ||
    url.startsWith('file://') ||
    url.startsWith('diagrade-asset://')
  );
}
