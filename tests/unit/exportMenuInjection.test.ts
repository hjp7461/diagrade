/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { injectExportMenus, __test__ } from '../../src/renderer/export/menu';

const { MENU_CLASS, BUTTON_CLASS, CHART_CLASS } = __test__;

/**
 * 테스트 fixture 는 jsdom 안에서 격리 실행되므로 일반 CSP/XSS 우려와 무관.
 * createElement + classList 로 명시 구성해 readability 도 보장.
 */
function buildContainer(specs: { kind: 'chart' | 'error' | 'text'; text?: string }[]): HTMLDivElement {
  const root = document.createElement('div');
  for (const spec of specs) {
    if (spec.kind === 'chart') {
      const chart = document.createElement('div');
      chart.className = CHART_CLASS;
      const svgNs = 'http://www.w3.org/2000/svg';
      chart.appendChild(document.createElementNS(svgNs, 'svg'));
      root.appendChild(chart);
    } else if (spec.kind === 'error') {
      const err = document.createElement('div');
      err.className = 'diagrade-mermaid-error';
      const pre = document.createElement('pre');
      pre.textContent = spec.text ?? 'broken';
      err.appendChild(pre);
      root.appendChild(err);
    } else {
      const p = document.createElement('p');
      p.textContent = spec.text ?? '본문';
      root.appendChild(p);
    }
  }
  document.body.replaceChildren(root);
  return root;
}

describe('injectExportMenus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('각 정상 mermaid 컨테이너에 메뉴를 주입한다', () => {
    const container = buildContainer([{ kind: 'chart' }, { kind: 'text' }, { kind: 'chart' }]);
    injectExportMenus(container, { activeTabPath: '/x/note.md', pngScale: 2 });
    expect(container.querySelectorAll('.' + MENU_CLASS)).toHaveLength(2);
  });

  it('각 메뉴는 PNG / SVG 두 버튼을 가진다 (FR-21)', () => {
    const container = buildContainer([{ kind: 'chart' }]);
    injectExportMenus(container, { activeTabPath: '/x/note.md', pngScale: 2 });
    const buttons = container.querySelectorAll<HTMLButtonElement>('.' + BUTTON_CLASS);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.textContent).toContain('PNG');
    expect(buttons[1]!.textContent).toContain('SVG');
  });

  it('FR-28: .diagrade-mermaid-error 에는 주입하지 않는다', () => {
    const container = buildContainer([{ kind: 'error' }, { kind: 'chart' }]);
    injectExportMenus(container, { activeTabPath: null, pngScale: 2 });
    const errMenu = container.querySelector('.diagrade-mermaid-error .' + MENU_CLASS);
    expect(errMenu).toBeNull();
    const okMenu = container.querySelector('.' + CHART_CLASS + ' .' + MENU_CLASS);
    expect(okMenu).not.toBeNull();
  });

  it('재호출에도 멱등 — 같은 차트에 메뉴를 두 번 추가하지 않음', () => {
    const container = buildContainer([{ kind: 'chart' }]);
    injectExportMenus(container, { activeTabPath: null, pngScale: 2 });
    injectExportMenus(container, { activeTabPath: null, pngScale: 2 });
    expect(container.querySelectorAll('.' + MENU_CLASS)).toHaveLength(1);
  });

  it('mermaid 컨테이너가 0 개면 no-op', () => {
    const container = buildContainer([{ kind: 'text' }]);
    expect(() => injectExportMenus(container, { activeTabPath: null, pngScale: 2 })).not.toThrow();
    expect(container.querySelectorAll('.' + MENU_CLASS)).toHaveLength(0);
  });

  it('PRD-011 FR-01: onZoomTrigger 정의 시 ⤢ 항목 추가, 정상 노드에만', () => {
    const container = buildContainer([{ kind: 'chart' }, { kind: 'error' }, { kind: 'chart' }]);
    const onZoom = vi.fn();
    injectExportMenus(container, { activeTabPath: '/x/note.md', pngScale: 2, onZoomTrigger: onZoom });
    const charts = container.querySelectorAll('.' + CHART_CLASS);
    expect(charts).toHaveLength(2);
    for (const c of charts) {
      const buttons = c.querySelectorAll<HTMLButtonElement>('.' + BUTTON_CLASS);
      expect(buttons).toHaveLength(3);
      expect(buttons[0]!.textContent).toContain('⤢');
    }
    // 에러 fallback 에는 메뉴 자체가 없음
    expect(container.querySelector('.diagrade-mermaid-error .' + BUTTON_CLASS)).toBeNull();
  });

  it('PRD-011: ⤢ 클릭 → onZoomTrigger(svg, 1-based index)', () => {
    const container = buildContainer([{ kind: 'chart' }, { kind: 'chart' }]);
    const onZoom = vi.fn();
    injectExportMenus(container, { activeTabPath: '/x/note.md', pngScale: 2, onZoomTrigger: onZoom });
    const secondChart = container.querySelectorAll('.' + CHART_CLASS)[1]!;
    const zoomBtn = secondChart.querySelector<HTMLButtonElement>('.' + BUTTON_CLASS)!;
    zoomBtn.click();
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(onZoom.mock.calls[0][1]).toBe(2);
    expect(onZoom.mock.calls[0][0].tagName.toLowerCase()).toBe('svg');
  });

  it('PRD-011: onZoomTrigger 미지정 시 ⤢ 미주입 — 회귀 보호 (PNG/SVG 두 개만)', () => {
    const container = buildContainer([{ kind: 'chart' }]);
    injectExportMenus(container, { activeTabPath: null, pngScale: 2 });
    const buttons = container.querySelectorAll<HTMLButtonElement>('.' + BUTTON_CLASS);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.textContent).not.toContain('⤢');
  });

  it('버튼 클릭 시 즉시 disabled + 라벨 ⏳ 생성 중… (FR-30) — saveFile 가 미정의여도 try/finally 로 원복', async () => {
    const container = buildContainer([{ kind: 'chart' }]);
    injectExportMenus(container, { activeTabPath: null, pngScale: 2 });
    const btn = container.querySelector<HTMLButtonElement>('.' + BUTTON_CLASS)!;
    const original = btn.textContent;

    // window.diagrade 가 없는 상태로 클릭. 에러는 catch 되어 finally 가 실행되어야 함.
    btn.click();
    // microtask 처리 대기
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe(original);
  });
});
