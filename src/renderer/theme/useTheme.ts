import { useEffect, useState } from 'react';
import type { ThemeSetting } from '../../shared/types';
import { computeEffectiveTheme, type EffectiveTheme } from './computeEffectiveTheme';

/**
 * 테마 hook. PRD-004 FR-02/04.
 *
 * - matchMedia('(prefers-color-scheme: dark)') 의 변화를 감지.
 * - setting (auto/light/dark) 와 결합해 effective theme 계산.
 * - body 에 `.diagrade-theme-dark` 클래스 토글.
 *
 * SSR 안전성: window 미정의 시 default light.
 */

const DARK_CLASS = 'diagrade-theme-dark';

export function useTheme(setting: ThemeSetting): EffectiveTheme {
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const effective = computeEffectiveTheme(setting, systemDark);

  useEffect(() => {
    document.body.classList.toggle(DARK_CLASS, effective === 'dark');
  }, [effective]);

  return effective;
}

/** 테스트 / 외부 진단용 — 현재 body 의 dark 활성 여부. */
export function isDarkActive(): boolean {
  return document.body.classList.contains(DARK_CLASS);
}
