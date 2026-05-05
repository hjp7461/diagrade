/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { svgXmlToDataUrl } from '../../src/renderer/export/svgToPngDataUrl';

describe('svgXmlToDataUrl — CSP 정합 (fix: PNG export root cause, PRD-016 후속)', () => {
  it("data:image/svg+xml;charset=utf-8, prefix 로 시작", () => {
    const url = svgXmlToDataUrl('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
  });

  it("'#' 같은 SVG 안의 reserved 문자가 % 인코딩됨 (#fff → %23fff)", () => {
    const url = svgXmlToDataUrl('<svg fill="#fff"/>');
    expect(url).not.toContain('#');
    expect(url).toContain('%23fff');
  });

  it('회귀 가드 — 결과는 절대 blob: 으로 시작하지 않는다', () => {
    // 본 앱의 CSP 가 img-src blob: 미허용. blob URL 로 회귀하면 PNG 저장 100% 실패.
    const url = svgXmlToDataUrl('<svg/>');
    expect(url.startsWith('blob:')).toBe(false);
  });

  it('빈 입력 — 본 함수는 거부 책임 없음 (caller 가 처리)', () => {
    expect(() => svgXmlToDataUrl('')).not.toThrow();
    expect(svgXmlToDataUrl('')).toBe('data:image/svg+xml;charset=utf-8,');
  });
});
