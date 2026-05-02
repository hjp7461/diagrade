/**
 * Strict web preferences enforcing PRD-001 §SEC-01/02/03.
 *
 * 순수 함수로 분리되어 있는 이유: BrowserWindow 생성 코드 전체를 단위 테스트하면
 * Electron 런타임 전체가 필요해진다. 이 함수만 테스트하면 vitest+jsdom 으로
 * 보안 옵션 회귀를 막을 수 있다.
 */

export interface StrictWebPreferences {
  preload: string;
  contextIsolation: true;
  nodeIntegration: false;
  sandbox: true;
  webSecurity: true;
}

export function getStrictWebPreferences(preloadPath: string): StrictWebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true
  };
}
