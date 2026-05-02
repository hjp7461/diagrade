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
    expect(findMatches(root, '', false)).toEqual([]);
  });

  it('매칭 0 개 → 빈 배열, DOM 변경 X', () => {
    const root = setup('hello world');
    const before = root.innerHTML;
    expect(findMatches(root, 'foo', false)).toEqual([]);
    expect(root.innerHTML).toBe(before);
  });

  it('단일 매칭 → 1 개 mark 반환, textContent 보존', () => {
    const root = setup('hello world');
    const matches = findMatches(root, 'world', false);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.textContent).toBe('world');
    expect(matches[0]!.classList.contains('diagrade-search-match')).toBe(true);
    // 본문 textContent 그대로
    expect(root.textContent).toBe('hello world');
  });

  it('동일 텍스트 노드 안 다중 매칭 (document 순서)', () => {
    const root = setup('hello world hello universe hello');
    const matches = findMatches(root, 'hello', false);
    expect(matches).toHaveLength(3);
    expect(matches.every((m) => m.textContent === 'hello')).toBe(true);
    // mark 들이 document 순서대로 위치
    const allMarks = Array.from(root.querySelectorAll('.diagrade-search-match'));
    expect(allMarks).toEqual(matches);
  });

  it('case-insensitive (기본)', () => {
    const root = setup('Hello WORLD hello');
    const matches = findMatches(root, 'hello', false);
    expect(matches).toHaveLength(2);
  });

  it('case-sensitive', () => {
    const root = setup('Hello WORLD hello');
    const matches = findMatches(root, 'hello', true);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.textContent).toBe('hello');
  });

  it('정규식 metachar 가 literal 로 처리 (SEC-01)', () => {
    const root = setup('a.b c.d a.b');
    const matches = findMatches(root, '.', false);
    // 점 3 개가 매칭 (정규식이라면 모든 문자가 매칭됐을 것)
    expect(matches).toHaveLength(3);
    expect(matches.every((m) => m.textContent === '.')).toBe(true);
  });

  it('이전 검색의 mark 안은 재검색에서 제외 (중첩 방지)', () => {
    const root = setup('hello world');
    findMatches(root, 'world', false);
    // 두번째 검색
    const matches = findMatches(root, 'world', false);
    // 이전 mark 안의 텍스트는 제외되므로 0 개
    expect(matches).toHaveLength(0);
  });

  it('한국어 매칭', () => {
    const root = setup('안녕 한국어 안녕 세상');
    const matches = findMatches(root, '안녕', false);
    expect(matches).toHaveLength(2);
  });

  it('clearHighlights — mark 제거 + textContent 그대로', () => {
    const root = setup('foo bar foo');
    findMatches(root, 'foo', false);
    expect(root.querySelectorAll('.diagrade-search-match')).toHaveLength(2);
    clearHighlights(root);
    expect(root.querySelectorAll('.diagrade-search-match')).toHaveLength(0);
    expect(root.textContent).toBe('foo bar foo');
  });

  it('clearHighlights 후 normalize — 인접 text node 병합', () => {
    const root = setup('aaa bbb ccc');
    findMatches(root, 'bbb', false);
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

    const matches = findMatches(root, 'foo', false);
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

    expect(findMatches(root, 'mermaid', false)).toHaveLength(0);
  });
});
