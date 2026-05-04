/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ZoomStage } from '../../src/renderer/components/DiagramZoomDialog/ZoomStage';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function makeSvg(viewBox = '0 0 100 50'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  // 식별을 위한 자식 노드.
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '10');
  svg.appendChild(rect);
  return svg as unknown as SVGSVGElement;
}

function mount(props: Parameters<typeof ZoomStage>[0]): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<ZoomStage {...props} />);
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('ZoomStage (PRD-011 §3.4, §6.3)', () => {
  it('FR-22: svgNode 의 cloneNode 사본이 host 에 mount, 원본은 영향 없음', () => {
    const original = makeSvg();
    const externalParent = document.createElement('div');
    externalParent.appendChild(original);

    mount({
      svgNode: original,
      level: 1,
      offset: { x: 0, y: 0 },
      contentSize: { w: 100, h: 50 },
      viewportSize: { w: 800, h: 600 },
      onOffsetChange: vi.fn()
    });

    // 원본은 외부 부모에 그대로
    expect(original.parentElement).toBe(externalParent);

    // 사본이 host 에 들어가 있음 (다른 노드 인스턴스)
    const host = container.querySelector('.diagrade-zoom-stage__svg-host')!;
    const mounted = host.querySelector('svg');
    expect(mounted).not.toBe(null);
    expect(mounted).not.toBe(original);
    expect(mounted!.querySelector('rect')).not.toBe(null);
  });

  it('초기 transform = translate + scale (props 그대로)', () => {
    mount({
      svgNode: makeSvg(),
      level: 1.5,
      offset: { x: 30, y: 20 },
      contentSize: { w: 150, h: 75 },
      viewportSize: { w: 800, h: 600 },
      onOffsetChange: vi.fn()
    });
    const inner = container.querySelector<HTMLDivElement>('.diagrade-zoom-stage__inner')!;
    expect(inner.style.transform).toBe('translate(30px, 20px) scale(1.5)');
  });

  it('FR-16: mousedown → grabbing 커서, mouseup → grab 커서', () => {
    mount({
      svgNode: makeSvg(),
      level: 1,
      offset: { x: 0, y: 0 },
      contentSize: { w: 100, h: 50 },
      viewportSize: { w: 800, h: 600 },
      onOffsetChange: vi.fn()
    });
    const stage = container.querySelector<HTMLDivElement>('.diagrade-zoom-stage')!;
    const inner = container.querySelector<HTMLDivElement>('.diagrade-zoom-stage__inner')!;

    expect(inner.style.cursor).toBe('grab');

    act(() => {
      stage.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 100, clientY: 100 })
      );
    });
    expect(inner.style.cursor).toBe('grabbing');

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100 }));
    });
    expect(inner.style.cursor).toBe('grab');
  });

  it('FR-16: 드래그 중 transform 이 마우스 변위에 따라 갱신', () => {
    const onChange = vi.fn();
    mount({
      svgNode: makeSvg(),
      level: 1,
      offset: { x: 0, y: 0 },
      contentSize: { w: 100, h: 50 },
      viewportSize: { w: 800, h: 600 },
      onOffsetChange: onChange
    });
    const stage = container.querySelector<HTMLDivElement>('.diagrade-zoom-stage')!;
    const inner = container.querySelector<HTMLDivElement>('.diagrade-zoom-stage__inner')!;

    act(() => {
      stage.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 100, clientY: 100 })
      );
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 130 }));
    });
    expect(inner.style.transform).toBe('translate(50px, 30px) scale(1)');

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 130 }));
    });
    // 콘텐츠가 viewport 보다 훨씬 작아 clamp 가 적용되지만 50, 30 은 범위 안.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual({ x: 50, y: 30 });
  });

  it('FR-19: 드래그 종료 시 clamp — 큰 양수 offset → maxX 까지만', () => {
    const onChange = vi.fn();
    mount({
      svgNode: makeSvg(),
      level: 1,
      offset: { x: 0, y: 0 },
      contentSize: { w: 100, h: 50 },
      viewportSize: { w: 800, h: 600 },
      onOffsetChange: onChange
    });
    const stage = container.querySelector<HTMLDivElement>('.diagrade-zoom-stage')!;
    act(() => {
      stage.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 0, clientY: 0 })
      );
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 99999, clientY: 99999 }));
    });
    const final = onChange.mock.calls[0][0];
    // maxX = viewport.w - margin = 800 - 80 = 720
    expect(final.x).toBe(720);
    expect(final.y).toBe(520);
  });

  it('우클릭 mousedown 은 무시 (button !== 0)', () => {
    const onChange = vi.fn();
    mount({
      svgNode: makeSvg(),
      level: 1,
      offset: { x: 0, y: 0 },
      contentSize: { w: 100, h: 50 },
      viewportSize: { w: 800, h: 600 },
      onOffsetChange: onChange
    });
    const stage = container.querySelector<HTMLDivElement>('.diagrade-zoom-stage')!;
    const inner = container.querySelector<HTMLDivElement>('.diagrade-zoom-stage__inner')!;
    act(() => {
      stage.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 2, clientX: 100, clientY: 100 })
      );
    });
    expect(inner.style.cursor).toBe('grab'); // 변화 없음
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }));
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 200, clientY: 200 }));
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
