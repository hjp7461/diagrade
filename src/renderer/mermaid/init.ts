/**
 * Mermaid 11 lazy 초기화. PRD-001 FR-06/07/09 + PRD-004 FR-11/12.
 *
 * - dynamic import — 번들 청크 분리 (외부 CDN 의존 X).
 * - securityLevel: 'strict' — 라벨의 <script> / HTML escape.
 * - startOnLoad: false — 명시적 render 호출.
 *
 * PRD-004: theme 인자에 따라 'default' (light) / 'dark' 로 reinit.
 * 같은 theme 로 다시 호출되면 noop. theme 가 바뀌면 mermaid.initialize 재실행.
 */

import type { EffectiveTheme } from '../theme/computeEffectiveTheme';

type MermaidModule = typeof import('mermaid');
type MermaidApi = MermaidModule['default'];
type MermaidTheme = 'default' | 'dark';

let mermaidPromise: Promise<MermaidApi> | null = null;
let initializedTheme: MermaidTheme | null = null;

async function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => mod.default);
  }
  return mermaidPromise;
}

/**
 * mermaid 'dark' 테마의 기본 pie 색은 거의 검정/짙은 자주라 다크 배경과 구분이 안 된다.
 * 다크 배경(#1a1a1a 근처)에서 서로 잘 구분되는 중간 명도 팔레트로 덮는다.
 */
const DARK_PIE_VARIABLES = {
  pie1: '#60a5fa',
  pie2: '#f472b6',
  pie3: '#34d399',
  pie4: '#fbbf24',
  pie5: '#a78bfa',
  pie6: '#f87171',
  pie7: '#22d3ee',
  pie8: '#fb923c',
  pie9: '#a3e635',
  pie10: '#e879f9',
  pie11: '#2dd4bf',
  pie12: '#94a3b8',
  // 조각 위 % 글자 — 밝은 조각 위라 어두운 글자가 읽힌다.
  pieSectionTextColor: '#0f172a',
  pieTitleTextColor: '#e2e8f0',
  pieLegendTextColor: '#e2e8f0',
  pieStrokeColor: '#1a1a1a',
  pieOuterStrokeColor: '#475569'
};

function toMermaidTheme(t: EffectiveTheme): MermaidTheme {
  return t === 'dark' ? 'dark' : 'default';
}

export async function getMermaid(theme: EffectiveTheme = 'light'): Promise<MermaidApi> {
  const mermaid = await loadMermaid();
  const target = toMermaidTheme(theme);
  if (initializedTheme !== target) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: target,
      themeVariables: target === 'dark' ? DARK_PIE_VARIABLES : {},
      fontFamily:
        'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence: { useMaxWidth: true },
      gantt: { useMaxWidth: true }
    });
    initializedTheme = target;
  }
  return mermaid;
}

/** 테스트용 — 모듈 상태를 초기화. */
export const __testReset = () => {
  mermaidPromise = null;
  initializedTheme = null;
};

/** 테스트용 — 현재 init 된 mermaid theme 확인. */
export const __getInitializedTheme = (): MermaidTheme | null => initializedTheme;
