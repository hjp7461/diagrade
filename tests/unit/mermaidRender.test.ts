/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import {
  __test__,
  isMermaidErrorNode,
  MERMAID_ERROR_CLASS,
  MERMAID_CONTAINER_CLASS
} from '../../src/renderer/mermaid/render';

const { buildErrorFallback } = __test__;

/**
 * mermaid.render 자체는 jsdom 에서 layout API (getBBox 등) 부족으로 실 동작이 어려우므로
 * 여기서는 구조적 단위 — 에러 fallback DOM 의 형태와 식별자만 검증한다.
 * 실 렌더는 M8 의 Playwright E2E 에서 다룬다.
 */
describe('Mermaid error fallback (FR-08)', () => {
  it('원본 코드 + 메시지를 모두 포함', () => {
    const fallback = buildErrorFallback('flowchart TD\nA-->B', 'Parse error: bad syntax');
    expect(fallback.textContent).toContain('flowchart TD');
    expect(fallback.textContent).toContain('A-->B');
    expect(fallback.textContent).toContain('Parse error: bad syntax');
    expect(fallback.textContent).toContain('다이어그램 렌더 실패');
  });

  it('식별 가능한 클래스를 가진다 (M5 export 메뉴 차단용, FR-28)', () => {
    const fallback = buildErrorFallback('x', 'y');
    expect(fallback.classList.contains(MERMAID_ERROR_CLASS)).toBe(true);
    expect(isMermaidErrorNode(fallback)).toBe(true);
  });

  it('정상 컨테이너 클래스와는 구분', () => {
    const normal = document.createElement('div');
    normal.className = MERMAID_CONTAINER_CLASS;
    expect(isMermaidErrorNode(normal)).toBe(false);
  });

  it('원본 코드는 escape 되어 안전하게 표시', () => {
    const malicious = '<script>alert(1)</script>';
    const fallback = buildErrorFallback(malicious, 'err');
    // textContent 로 들어가서 element 가 아닌 텍스트로 escape 됨
    expect(fallback.querySelector('script')).toBeNull();
    expect(fallback.textContent).toContain(malicious);
  });

  it('에러 메시지의 줄바꿈 보존 (white-space: pre-wrap)', () => {
    const fallback = buildErrorFallback('x', 'line 1\nline 2');
    const msg = fallback.querySelector('p');
    expect(msg?.style.whiteSpace).toBe('pre-wrap');
  });
});
