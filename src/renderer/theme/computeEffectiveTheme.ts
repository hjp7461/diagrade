import type { ThemeSetting } from '../../shared/types';

/**
 * 사용자 설정 + OS prefers-color-scheme 결과 → 실제 적용할 테마.
 * 순수 함수 — 테스트 가능 (matchMedia mock 없이).
 *
 * PRD-004 FR-02/03.
 */

export type EffectiveTheme = 'light' | 'dark';

export function computeEffectiveTheme(
  setting: ThemeSetting,
  systemDark: boolean
): EffectiveTheme {
  if (setting === 'auto') return systemDark ? 'dark' : 'light';
  return setting;
}
