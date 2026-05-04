/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import {
  __test__,
  isMermaidErrorNode,
  MERMAID_ERROR_CLASS,
  MERMAID_CONTAINER_CLASS
} from '../../src/renderer/mermaid/render';

const { buildErrorFallback, parseSvg } = __test__;

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
    const msg = fallback.querySelector('.diagrade-mermaid-error-message') as HTMLElement | null;
    expect(msg?.style.whiteSpace).toBe('pre-wrap');
  });

  it('PRD-012: 사용자 안내 hint 한 줄 포함 (mermaid live editor 안내)', () => {
    const fallback = buildErrorFallback('x', 'y');
    const hint = fallback.querySelector('.diagrade-mermaid-error-hint');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain('mermaid');
    expect(hint?.textContent).toContain('mermaid.live');
  });
});

describe('parseSvg — HTML 파서 (PRD-012 Issue A 회귀)', () => {
  it('단순 SVG → SVGElement 반환 (viewBox attribute 보존)', () => {
    const el = parseSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>');
    expect(el).not.toBeNull();
    expect(el?.tagName.toLowerCase()).toBe('svg');
    // jsdom 의 HTML 파서 모드는 SVGSVGElement.viewBox.baseVal 접근자를 미구현하므로
    // attribute 만 검증한다. production Chromium 에서는 baseVal 도 정상 동작.
    expect(el?.getAttribute('viewBox')).toBe('0 0 10 10');
  });

  it('foreignObject 안의 void HTML 요소(<br>) 가 들어있어도 파싱 성공 (PRD-012 핵심 회귀)', () => {
    // 이전 strict XML 파서는 첫 <br> 에서 mismatch 로 실패. HTML 파서는 정상 처리.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <foreignObject width="100" height="100">
        <div xmlns="http://www.w3.org/1999/xhtml">
          line one<br>line two<br>line three
        </div>
      </foreignObject>
    </svg>`;
    const el = parseSvg(svg);
    expect(el).not.toBeNull();
    expect(el?.tagName.toLowerCase()).toBe('svg');
    // foreignObject 와 텍스트가 살아있어야 함.
    expect(el?.querySelector('foreignObject')).not.toBeNull();
    expect(el?.textContent).toContain('line one');
    expect(el?.textContent).toContain('line two');
  });

  it('SVG 가 아닌 입력 → null', () => {
    expect(parseSvg('<div>not svg</div>')).toBeNull();
    expect(parseSvg('plain text')).toBeNull();
  });
});
