/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { findMatches } from '../../src/renderer/search/findMatches';
import { clearHighlights } from '../../src/renderer/search/clearHighlights';

function setup(html: string): HTMLDivElement {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  // 보안 훅 우회: createElement + textContent / appendChild 로 fixture 구성
  // (innerHTML 사용 안 함)
  // 간단하게 createElement + textContent 로 한 줄짜리 본문 만든다.
  // 복잡한 구조가 필요하면 호출자가 직접 구성.
  const p = document.createElement('p');
  p.textContent = html; // 여기는 텍스트만
  root.appendChild(p);
  return root;
}

describe('findMatches + clearHighlights (PRD-003 §3.3, §3.4, NFR-03)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('빈 query → 빈 배열', () => {
    const root = setup('hello world');
    expect(findMatches(root, '', { caseSensitive: false })).toEqual([]);
  });

  it('매칭 0 개 → 빈 배열, DOM 변경 X', () => {
    const root = setup('hello world');
    const before = root.innerHTML;
    expect(findMatches(root, 'foo', { caseSensitive: false })).toEqual([]);
    expect(root.innerHTML).toBe(before);
  });

  it('단일 매칭 → 1 개 mark 반환, textContent 보존', () => {
    const root = setup('hello world');
    const matches = findMatches(root, 'world', { caseSensitive: false });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.textContent).toBe('world');
    expect(matches[0]!.classList.contains('diagrade-search-match')).toBe(true);
    // 본문 textContent 그대로
    expect(root.textContent).toBe('hello world');
  });

  it('동일 텍스트 노드 안 다중 매칭 (document 순서)', () => {
    const root = setup('hello world hello universe hello');
    const matches = findMatches(root, 'hello', { caseSensitive: false });
    expect(matches).toHaveLength(3);
    expect(matches.every((m) => m.textContent === 'hello')).toBe(true);
    // mark 들이 document 순서대로 위치
    const allMarks = Array.from(root.querySelectorAll('.diagrade-search-match'));
    expect(allMarks).toEqual(matches);
  });

  it('case-insensitive (기본)', () => {
    const root = setup('Hello WORLD hello');
    const matches = findMatches(root, 'hello', { caseSensitive: false });
    expect(matches).toHaveLength(2);
  });

  it('case-sensitive', () => {
    const root = setup('Hello WORLD hello');
    const matches = findMatches(root, 'hello', { caseSensitive: true });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.textContent).toBe('hello');
  });

  it('정규식 metachar 가 literal 로 처리 (SEC-01)', () => {
    const root = setup('a.b c.d a.b');
    const matches = findMatches(root, '.', { caseSensitive: false });
    // 점 3 개가 매칭 (정규식이라면 모든 문자가 매칭됐을 것)
    expect(matches).toHaveLength(3);
    expect(matches.every((m) => m.textContent === '.')).toBe(true);
  });

  it('이전 검색의 mark 안은 재검색에서 제외 (중첩 방지)', () => {
    const root = setup('hello world');
    findMatches(root, 'world', { caseSensitive: false });
    // 두번째 검색
    const matches = findMatches(root, 'world', { caseSensitive: false });
    // 이전 mark 안의 텍스트는 제외되므로 0 개
    expect(matches).toHaveLength(0);
  });

  it('한국어 매칭', () => {
    const root = setup('안녕 한국어 안녕 세상');
    const matches = findMatches(root, '안녕', { caseSensitive: false });
    expect(matches).toHaveLength(2);
  });

  it('clearHighlights — mark 제거 + textContent 그대로', () => {
    const root = setup('foo bar foo');
    findMatches(root, 'foo', { caseSensitive: false });
    expect(root.querySelectorAll('.diagrade-search-match')).toHaveLength(2);
    clearHighlights(root);
    expect(root.querySelectorAll('.diagrade-search-match')).toHaveLength(0);
    expect(root.textContent).toBe('foo bar foo');
  });

  it('clearHighlights 후 normalize — 인접 text node 병합', () => {
    const root = setup('aaa bbb ccc');
    findMatches(root, 'bbb', { caseSensitive: false });
    clearHighlights(root);
    // 본문 단락 안에 text node 1 개만 (mark 의 splitText + clear 후 병합)
    const p = root.querySelector('p')!;
    expect(p.childNodes).toHaveLength(1);
    expect(p.childNodes[0]!.nodeType).toBe(Node.TEXT_NODE);
  });

  it('SVG 안 텍스트는 검색 제외 (FR-13)', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const para = document.createElement('p');
    para.textContent = 'foo';
    root.appendChild(para);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'foo';
    svg.appendChild(text);
    root.appendChild(svg);

    const matches = findMatches(root, 'foo', { caseSensitive: false });
    expect(matches).toHaveLength(1);
    // SVG 안의 'foo' 는 매칭에서 제외 — 매칭 element 의 부모가 svg 가 아닌지 확인
    expect(matches[0]!.closest('svg')).toBeNull();
  });

  it('foreignObject 안 텍스트도 svg 하위라 제외', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    const fo = document.createElementNS(svgNs, 'foreignObject');
    const div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    div.textContent = 'mermaid label';
    fo.appendChild(div);
    svg.appendChild(fo);
    root.appendChild(svg);

    expect(findMatches(root, 'mermaid', { caseSensitive: false })).toHaveLength(0);
  });
});

describe('findMatches PRD-007 옵션 — wholeWord / regex', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('wholeWord ON — set 검색이 setting / subset 미매칭, 단독 set 만', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const p = document.createElement('p');
    p.textContent = 'set setting subset set assertion set';
    root.appendChild(p);

    const matches = findMatches(root, 'set', { wholeWord: true });
    expect(matches).toHaveLength(3);
    expect(matches.every((m) => m.textContent === 'set')).toBe(true);
  });

  it('wholeWord OFF (default) — 모든 문자열 매칭', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const p = document.createElement('p');
    p.textContent = 'set setting subset';
    root.appendChild(p);
    expect(findMatches(root, 'set', {})).toHaveLength(3);
  });

  it('regex ON — 패턴 매칭 (\\d+)', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const p = document.createElement('p');
    p.textContent = '버전 1.2.3 빌드 4567 릴리스 89';
    root.appendChild(p);
    const matches = findMatches(root, '\\d+', { regex: true });
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });

  it('regex ON + 잘못된 패턴 → 0 매칭 (앱 크래시 X)', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const p = document.createElement('p');
    p.textContent = 'foo bar';
    root.appendChild(p);
    expect(() => findMatches(root, '(unclosed', { regex: true })).not.toThrow();
    expect(findMatches(root, '(unclosed', { regex: true })).toHaveLength(0);
  });

  it('regex + wholeWord 조합 — \\w+ 패턴이 단어 경계로 한정', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const p = document.createElement('p');
    p.textContent = 'foo bar baz';
    root.appendChild(p);
    // \w+ 만 ON 이면 'foo' 'bar' 'baz' 3 단어. wholeWord 도 ON 이면 동일 3 (이미 단어 단위).
    const matches = findMatches(root, '\\w+', { regex: true, wholeWord: true });
    expect(matches).toHaveLength(3);
  });

  it('zero-width regex (lookahead) 무한 루프 방지', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const p = document.createElement('p');
    p.textContent = 'aaaa';
    root.appendChild(p);
    // (?=a) 는 zero-width. 무한 루프 방지 가드가 동작해야 함.
    expect(() => findMatches(root, '(?=a)', { regex: true })).not.toThrow();
    // 매칭은 0 (zero-width 는 무시되어 mark 안 만듦).
    expect(findMatches(root, '(?=a)', { regex: true })).toHaveLength(0);
  });

  it('caseSensitive + wholeWord 조합', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const p = document.createElement('p');
    p.textContent = 'Set setting set SETTING';
    root.appendChild(p);
    const matches = findMatches(root, 'set', { wholeWord: true, caseSensitive: true });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.textContent).toBe('set');
  });

  it('변동 길이 매칭 (regex \\w+) 정확히 wrap', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const p = document.createElement('p');
    p.textContent = 'a bb ccc dddd';
    root.appendChild(p);
    const matches = findMatches(root, '\\w+', { regex: true });
    expect(matches).toHaveLength(4);
    expect(matches[0]!.textContent).toBe('a');
    expect(matches[1]!.textContent).toBe('bb');
    expect(matches[2]!.textContent).toBe('ccc');
    expect(matches[3]!.textContent).toBe('dddd');
  });
});
