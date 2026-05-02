/**
 * SVG 직렬화 — CLAUDE.md pitfall #3, FR-25, §6.1.
 *
 * **outerHTML 사용 금지.** outerHTML 은 HTML serializer 라 `<br>`, `<hr>`, `<img>` 같은
 * void 요소를 self-close 없이 출력한다. mermaid flowchart 의 `<foreignObject>` 안에
 * `<br>` 가 들어가는데, 그 결과 strict XML 파서(macOS Quick Look, Preview, xmllint) 가
 * "Opening and ending tag mismatch: br" 로 파싱 실패. 브라우저는 HTML-parse 라 안 보임.
 *
 * 모든 SVG 추출 경로(개별 ⬇ SVG, ⬇ PNG 의 래스터 소스, 일괄 저장)는 이 헬퍼만 사용.
 */

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export function ensureSvgNs<T extends SVGSVGElement>(svg: T): T {
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', SVG_NAMESPACE);
  }
  return svg;
}

export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  return new XMLSerializer().serializeToString(ensureSvgNs(clone));
}
