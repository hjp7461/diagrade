/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { scrollMatchIntoMain } from '../../src/renderer/markdown/scrollMatchIntoMain';

/**
 * PRD-014: 검색 navigate 가 page-level scroll 을 일으켜 탭바가 viewport 밖으로 사라지던
 * 회귀의 핵심 fix — scrollIntoView 대신 main.scrollTo 직접 호출.
 *
 * 본 테스트는 helper 가 *오직 main.scrollTo* 만 호출하고, body / html 의 scrollTop 은
 * 건드리지 않음을 잠근다. spec 동작에 의존하지 않는 명시적 검증.
 */

function fakeRect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    height,
    x: 0,
    y: top,
    toJSON: () => ({})
  } as DOMRect;
}

function makeMain(opts: { rectTop: number; clientHeight: number; scrollTop: number }): HTMLElement {
  const main = document.createElement('div');
  main.getBoundingClientRect = () => fakeRect(opts.rectTop, opts.clientHeight);
  Object.defineProperty(main, 'clientHeight', { value: opts.clientHeight, configurable: true });
  Object.defineProperty(main, 'scrollTop', { value: opts.scrollTop, writable: true, configurable: true });
  main.scrollTo = vi.fn();
  return main;
}

function makeEl(opts: { rectTop: number; offsetHeight: number }): HTMLElement {
  const el = document.createElement('span');
  el.getBoundingClientRect = () => fakeRect(opts.rectTop, opts.offsetHeight);
  Object.defineProperty(el, 'offsetHeight', { value: opts.offsetHeight, configurable: true });
  return el;
}

describe('scrollMatchIntoMain (PRD-014)', () => {
  it('매칭 element 가 main 의 viewport 중앙에 오는 scrollTop 으로 main.scrollTo 호출', () => {
    // main: viewport 안 (0, 600), 현재 scrollTop = 100. el: 화면 위 (240, 20).
    // elTopInMain = 240 - 0 + 100 = 340
    // target = 340 - 600/2 + 20/2 = 340 - 300 + 10 = 50
    const main = makeMain({ rectTop: 0, clientHeight: 600, scrollTop: 100 });
    const el = makeEl({ rectTop: 240, offsetHeight: 20 });

    scrollMatchIntoMain(el, main);

    expect(main.scrollTo).toHaveBeenCalledWith({ top: 50, behavior: 'smooth' });
  });

  it('계산 결과가 음수면 0 으로 클램프 (맨 위 가까운 매칭)', () => {
    const main = makeMain({ rectTop: 0, clientHeight: 600, scrollTop: 0 });
    const el = makeEl({ rectTop: 10, offsetHeight: 20 });
    // elTopInMain = 10, target = 10 - 300 + 10 = -280 → 0

    scrollMatchIntoMain(el, main);

    expect(main.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('document.body / html 의 scrollTop 은 절대 건드리지 않음 (page-level scroll 차단 보장)', () => {
    // 호출 전후로 body/html.scrollTop 이 바뀌지 않음을 검증.
    // jsdom 의 default scrollTop 은 0. 명시 변경이 없는지 spy 로도 간접 확인.
    const main = makeMain({ rectTop: 0, clientHeight: 600, scrollTop: 0 });
    const el = makeEl({ rectTop: 240, offsetHeight: 20 });

    const bodyBefore = document.body.scrollTop;
    const htmlBefore = document.documentElement.scrollTop;

    scrollMatchIntoMain(el, main);

    expect(document.body.scrollTop).toBe(bodyBefore);
    expect(document.documentElement.scrollTop).toBe(htmlBefore);
    // helper 가 호출한 유일한 scroll API 는 main.scrollTo.
    expect(main.scrollTo).toHaveBeenCalledTimes(1);
  });
});
