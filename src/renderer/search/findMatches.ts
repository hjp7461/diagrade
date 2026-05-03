import { escapeRegExp } from './escapeRegExp';

/**
 * 컨테이너 안에서 query 와 매칭하는 모든 텍스트 위치를 찾아 mark 로 wrap.
 * 결과는 document 순서의 mark element 배열.
 *
 * PRD-003 + PRD-007:
 *   - opts.caseSensitive: 대소문자 구분
 *   - opts.wholeWord: 단어 경계 강제 (regex word boundary)
 *   - opts.regex: 사용자 입력을 정규식으로 컴파일. 잘못된 패턴은 0 매칭
 *   - 모든 옵션 자유 조합
 *
 * 검색 범위 (PRD-003 §3.3):
 *   - 일반 텍스트, 코드 블록 (Shiki span 포함): 포함
 *   - 이전 검색의 .diagrade-search-match: 제외 (재검색 중첩 방지)
 *   - .diagrade-search-bar: 제외
 *   - svg 안 모든 텍스트: 제외 (mermaid SVG, FR-13)
 *
 * **across text nodes 검색 미지원**.
 *
 * **DOM 변형**: splitText + 부모 교체로만 (innerHTML 직접 할당 X — SEC-02).
 *
 * **Zero-width 매칭 가드**: lookahead 같은 zero-width regex 가 무한 루프하지 않도록
 * lastIndex 강제 advance (FR-08).
 */

export interface FindMatchesOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

export function findMatches(
  root: HTMLElement,
  query: string,
  opts: FindMatchesOptions = {}
): HTMLElement[] {
  if (!query) return [];

  const { caseSensitive = false, wholeWord = false, regex = false } = opts;

  let pattern: string;
  if (regex) {
    pattern = query;
  } else {
    pattern = escapeRegExp(query);
    if (pattern.length === 0) return [];
  }
  if (wholeWord) {
    pattern = '\\b' + pattern + '\\b';
  }

  const flags = 'g' + (caseSensitive ? '' : 'i');

  let re: RegExp;
  try {
    re = new RegExp(pattern, flags);
  } catch {
    // 잘못된 정규식 - 0 매칭 (FR-05 SEC-01).
    return [];
  }

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
    if (text.length === 0) continue;

    re.lastIndex = 0;
    const positions: { start: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const matched = m[0];
      if (matched.length === 0) {
        re.lastIndex = m.index + 1;
        if (re.lastIndex > text.length) break;
        continue;
      }
      positions.push({ start: m.index, end: m.index + matched.length });
    }
    if (positions.length === 0) continue;

    const localMatches: HTMLElement[] = [];
    for (let i = positions.length - 1; i >= 0; i--) {
      const { start, end } = positions[i]!;

      textNode.splitText(end);
      const matchTextNode = textNode.splitText(start);

      const mark = document.createElement('mark');
      mark.className = 'diagrade-search-match';
      matchTextNode.replaceWith(mark);
      mark.appendChild(matchTextNode);

      localMatches.push(mark);
    }
    localMatches.reverse();
    allMatches.push(...localMatches);
  }

  return allMatches;
}

export { escapeRegExp };
