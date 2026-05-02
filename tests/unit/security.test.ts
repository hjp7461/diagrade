import { describe, it, expect } from 'vitest';
import {
  getStrictWebPreferences,
  type StrictWebPreferences
} from '../../src/main/security';
import { isAllowedInternalUrl, isExternalHttpUrl } from '../../src/main/url';

/**
 * PRD-001 §SEC-01/02/03 의 webPreferences 회귀 방지.
 *
 * 향후 누군가 "디버깅 편하게" 라며 nodeIntegration 을 켜거나 sandbox 를 끌 때
 * 이 테스트가 막는다. CLAUDE.md "Testing" 절의 명시 요구이기도 함.
 */
describe('getStrictWebPreferences', () => {
  const prefs: StrictWebPreferences = getStrictWebPreferences('/some/preload.js');

  it('SEC-02: contextIsolation 은 true 로 강제된다', () => {
    expect(prefs.contextIsolation).toBe(true);
  });

  it('SEC-01: nodeIntegration 은 false 로 강제된다', () => {
    expect(prefs.nodeIntegration).toBe(false);
  });

  it('SEC-03: sandbox 는 true 로 강제된다', () => {
    expect(prefs.sandbox).toBe(true);
  });

  it('SEC-06 보조: webSecurity 는 true 로 강제된다 (기본값이지만 명시)', () => {
    expect(prefs.webSecurity).toBe(true);
  });

  it('preload 경로는 인자로 받은 그대로 보존된다', () => {
    const arbitrary = '/x/y/z/preload.js';
    expect(getStrictWebPreferences(arbitrary).preload).toBe(arbitrary);
  });

  it('타입 레벨에서 허용 값이 좁혀져 있어 잘못된 값 할당이 컴파일 시점에 차단된다', () => {
    // 컴파일 타임 가드: StrictWebPreferences 의 contextIsolation 은 literal `true`.
    // 만약 누가 boolean 으로 완화하면 다음 줄이 통과해버린다.
    // @ts-expect-error contextIsolation 은 literal true 여야 함
    const bad: StrictWebPreferences = { ...prefs, contextIsolation: false };
    expect(bad.contextIsolation).toBe(false);
  });
});

/**
 * SEC-05 헬퍼 회귀 방지. 외부 URL 은 외부 브라우저로,
 * 그 외 임의 navigate 는 차단되어야 한다.
 */
describe('navigation guards', () => {
  it('http/https 는 external 로 분류', () => {
    expect(isExternalHttpUrl('https://example.com')).toBe(true);
    expect(isExternalHttpUrl('http://example.com')).toBe(true);
    expect(isExternalHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isExternalHttpUrl('diagrade-asset://abc/foo.png')).toBe(false);
  });

  it('localhost / file:// / diagrade-asset:// 만 internal 로 허용', () => {
    expect(isAllowedInternalUrl('http://localhost:5173/')).toBe(true);
    expect(isAllowedInternalUrl('http://127.0.0.1:5173/')).toBe(true);
    expect(isAllowedInternalUrl('file:///Users/foo/index.html')).toBe(true);
    expect(isAllowedInternalUrl('diagrade-asset://tab1/img.png')).toBe(true);
    expect(isAllowedInternalUrl('https://evil.example.com')).toBe(false);
    expect(isAllowedInternalUrl('http://evil.example.com')).toBe(false);
  });
});
