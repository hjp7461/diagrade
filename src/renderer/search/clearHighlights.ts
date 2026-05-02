/**
 * 검색 종료 시 모든 `<mark class="diagrade-search-match">` 를 unwrap 후 normalize.
 * PRD-003 NFR-03.
 *
 * 동작:
 *   1) 모든 mark 를 자신의 textContent 만 남기고 제거 (`replaceWith(textNode)`).
 *   2) `Node.normalize()` 로 인접 text node 병합 — 다음 검색이 정확히 동작하도록.
 *
 * normalize 가 중요: 분리된 채로 두면 다음 findMatches 가 같은 chunk 를 여러 text node 에
 * 나눠 보게 되어 across-node 검색이 안 되는 케이스가 늘어남.
 */
export function clearHighlights(root: HTMLElement): void {
  const marks = root.querySelectorAll('.diagrade-search-match');
  marks.forEach((mark) => {
    const text = document.createTextNode(mark.textContent ?? '');
    mark.replaceWith(text);
  });
  root.normalize();
}
