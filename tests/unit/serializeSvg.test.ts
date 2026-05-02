/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { ensureSvgNs, serializeSvg } from '../../src/renderer/export/serializeSvg';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

function makeSvg(): SVGSVGElement {
  return document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
}

describe('ensureSvgNs', () => {
  it('xmlns 가 없으면 SVG 표준 namespace 추가', () => {
    const svg = makeSvg();
    svg.removeAttribute('xmlns');
    const out = ensureSvgNs(svg);
    expect(out.getAttribute('xmlns')).toBe(SVG_NS);
  });

  it('xmlns 가 이미 있으면 그대로 보존 (덮어쓰지 않음)', () => {
    const svg = makeSvg();
    const custom = 'http://example.com/custom-svg-ns';
    svg.setAttribute('xmlns', custom);
    expect(ensureSvgNs(svg).getAttribute('xmlns')).toBe(custom);
  });
});

describe('serializeSvg (CLAUDE.md pitfall #3)', () => {
  it('void 요소는 self-close 로 출력 (XML serializer 동작 — Quick Look/Preview 호환)', () => {
    const svg = makeSvg();
    svg.setAttribute('viewBox', '0 0 100 100');

    const fo = document.createElementNS(SVG_NS, 'foreignObject');
    const div = document.createElementNS(XHTML_NS, 'div');
    div.appendChild(document.createElementNS(XHTML_NS, 'br'));
    div.appendChild(document.createElementNS(XHTML_NS, 'hr'));
    fo.appendChild(div);
    svg.appendChild(fo);

    const xml = serializeSvg(svg);

    // XML serializer 는 void 요소를 self-close 로 출력해야 한다.
    // raw `<br>` 가 들어가면 strict XML 파서가 깨진다.
    expect(xml).not.toMatch(/<br>(?!\/)/);
    expect(xml).not.toMatch(/<hr>(?!\/)/);
    expect(xml.toLowerCase()).toMatch(/<br\s*\/>|<br ?\/>/);
  });

  it('xmlns 자동 부여', () => {
    const svg = makeSvg();
    svg.removeAttribute('xmlns');
    const xml = serializeSvg(svg);
    expect(xml).toContain(`xmlns="${SVG_NS}"`);
  });

  it('viewBox 보존', () => {
    const svg = makeSvg();
    svg.setAttribute('viewBox', '0 0 200 150');
    expect(serializeSvg(svg)).toContain('viewBox="0 0 200 150"');
  });

  it('원본 SVG 는 수정하지 않는다 (clone 사용)', () => {
    const svg = makeSvg();
    svg.removeAttribute('xmlns');
    serializeSvg(svg);
    expect(svg.getAttribute('xmlns')).toBeNull();
  });
});
