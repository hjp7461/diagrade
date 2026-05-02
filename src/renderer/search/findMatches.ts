import { escapeRegExp } from './escapeRegExp';

/**
 * 컨테이너 안에서 query 와 매칭하는 모든 텍스트 위치를 찾아 `<mark class="diagrade-search-match">`
 * 로 wrap. 결과는 document 순서의 mark element 배열.
 *
 * 검색 범위 (PRD-003 §3.3):
 *   - 일반 텍스트 (h1~h6, p, li, td 등): 포함
 *   - 코드 블록 (Shiki 의 <span class="line">): 포함
 *   - 이전 검색의 .diagrade-search-match: 제외 (재검색 시 중첩 방지)
 *   - .diagrade-search-bar: 제외 (검색바 자체가 query 와 겹쳐도 매칭 X)
 *   - svg 안의 모든 텍스트: 제외 (mermaid SVG 텍스트, FR-13)
 *
 * **across text nodes 검색 미지원**: 예를 들어 `<p>foo <b>bar</b> baz</p>` 에서 "foo bar"
 * 는 매칭 안 됨 (text node 가 분리되어 있음). v1.0 의 의도된 단순화.
 *
 * **escapeRegExp** 로 query 의 정규식 metachar 를 literal 처리 (SEC-01).
 *
 * **DOM 변형은 splitText + 부모 교체로만**. innerHTML 직접 할당 X (SEC-02).
 */
export function findMatches(
  root: HTMLElement,
  query: string,
  caseSensitive: boolean
): HTMLElement[] {
  if (!query) return [];

  const needle = caseSensitive ? query : query.toLowerCase();
  if (needle.length === 0) return [];

  // Text node 수집 (검색 제외 영역 필터).
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('.diagrade-search-match')) return NodeFilter.FILTER_REJECT;
      if (parent.closest('.diagrade-search-bar')) return NodeFilter.FILTER_REJECT;
      if (parent.closest('svg')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode()) !== null) {
    textNodes.push(n as Text);
  }

  const allMatches: HTMLElement[] = [];

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? '';
    const haystack = caseSensitive ? text : text.toLowerCase();

    // 이 노드의 모든 매칭 위치 (오름차순).
    const positions: number[] = [];
    let pos = haystack.indexOf(needle);
    while (pos !== -1) {
      positions.push(pos);
      pos = haystack.indexOf(needle, pos + needle.length);
    }
    if (positions.length === 0) continue;

    // 뒤에서 앞으로 split — offset 변동 회피.
    const localMatches: HTMLElement[] = [];
    for (let i = positions.length - 1; i >= 0; i--) {
      const start = positions[i]!;
      const end = start + needle.length;

      // textNode 를 [..start)[start..end)[end..) 세 조각으로 split.
      // splitText(end) — textNode 가 [0..end), 반환된 노드가 [end..)
      // splitText(start) on textNode — textNode 가 [0..start), 반환된 노드가 [start..end)
      textNode.splitText(end);
      const matchTextNode = textNode.splitText(start);

      const mark = document.createElement('mark');
      mark.className = 'diagrade-search-match';
      // matchTextNode 자체를 mark 안으로 옮김 (innerHTML 직접 할당 X).
      matchTextNode.replaceWith(mark);
      mark.appendChild(matchTextNode);

      localMatches.push(mark);
    }
    // 처리 순서가 reverse 라 localMatches 도 reverse — 다시 뒤집어 document 순서로.
    localMatches.reverse();
    allMatches.push(...localMatches);
  }

  // escapeRegExp 는 본 모듈에서 직접 RegExp 사용은 안 하지만 (literal indexOf),
  // 추후 정규식 toggle 추가 시 필요하므로 export 유지.
  void escapeRegExp;

  return allMatches;
}

// escapeRegExp 도 같은 모듈에서 export (테스트 통일).
export { escapeRegExp };
