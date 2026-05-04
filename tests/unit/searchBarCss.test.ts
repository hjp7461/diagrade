/**
 * PRD-013 회귀 잠금 — searchBar.css 의 폭 관련 상수가 회귀 안전한 값임을 검증.
 *
 * jsdom 은 CSS layout 을 계산하지 않아 *시각적* 회귀 (버튼 잘림) 를 직접 잡지 못한다.
 * 그래서 CSS 텍스트에서 핵심 상수를 추출해 PRD-013 §6.2 가 정한 안전 영역 안에 있는지
 * 확인한다 — 상수가 다시 작은 값으로 돌아가면 (예: 누가 max-width 를 360 으로 되돌림)
 * 본 테스트가 fail 한다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = join(__dirname, '../../src/renderer/search/searchBar.css');
const css = readFileSync(cssPath, 'utf-8');

function readPxInBlock(selector: string, prop: string): number | null {
  // selector { ... prop: <n>(px)? ... } 의 <n> 추출. CSS 에서 0 은 단위 생략이 일반적이라 px? 로.
  const blockMatch = css.match(new RegExp(`${escapeRegex(selector)}\\s*\\{([^}]*)\\}`));
  if (!blockMatch) return null;
  const block = blockMatch[1];
  const propMatch = block.match(new RegExp(`(?:^|;|\\n)\\s*${escapeRegex(prop)}\\s*:\\s*(\\d+)(?:px)?\\b`));
  if (!propMatch) return null;
  return Number(propMatch[1]);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('PRD-013: searchBar.css 폭 회귀 잠금', () => {
  it('.diagrade-search-bar 의 max-width 는 480px 이상 (자식 자연 폭 합 커버)', () => {
    const maxW = readPxInBlock('.diagrade-search-bar', 'max-width');
    // 자식 자연 폭 합 ≈ 450px. 여유 30px 이상 → 480px 이상.
    expect(maxW).not.toBeNull();
    expect(maxW!).toBeGreaterThanOrEqual(480);
  });

  it('.diagrade-search-bar__input 의 min-width 는 100px 미만 (좁은 창에서 input shrink 보장)', () => {
    const minW = readPxInBlock('.diagrade-search-bar__input', 'min-width');
    expect(minW).not.toBeNull();
    expect(minW!).toBeLessThan(100);
  });

  it('.diagrade-search-bar__count 의 min-width 는 44px 이상 (4 자리 카운터 여유)', () => {
    const minW = readPxInBlock('.diagrade-search-bar__count', 'min-width');
    expect(minW).not.toBeNull();
    expect(minW!).toBeGreaterThanOrEqual(44);
  });
});
