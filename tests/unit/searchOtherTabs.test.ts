import { describe, it, expect, vi } from 'vitest';
import {
  searchOtherTabs,
  countMatches,
  type OtherTabInput
} from '../../src/renderer/search/searchOtherTabs';

const TABS: OtherTabInput[] = [
  { id: 'a', filePath: '/x/a.md', fileName: 'a.md' },
  { id: 'b', filePath: '/x/b.md', fileName: 'b.md' },
  { id: 'c', filePath: '/x/c.md', fileName: 'c.md' }
];

function fetcherOf(map: Record<string, string>) {
  return vi.fn(async (path: string) => {
    if (!(path in map)) throw new Error(`not found: ${path}`);
    return map[path]!;
  });
}

describe('countMatches', () => {
  it('literal 매칭 카운트', () => {
    expect(countMatches('hello hello', /hello/g)).toBe(2);
  });

  it('case-insensitive', () => {
    expect(countMatches('Hello hello HELLO', /hello/gi)).toBe(3);
  });

  it('zero-width 매칭은 카운트 X (PRD-007 FR-08 동등)', () => {
    expect(countMatches('abc', /(?=a)/g)).toBe(0);
  });

  it('빈 텍스트 → 0', () => {
    expect(countMatches('', /x/g)).toBe(0);
  });
});

describe('searchOtherTabs (PRD-009 FR-04~FR-09)', () => {
  it('빈 query → 빈 배열, fetcher 호출 X', async () => {
    const fetcher = fetcherOf({});
    const r = await searchOtherTabs(TABS, '', {}, fetcher);
    expect(r).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('탭 0 개 → 빈 배열', async () => {
    const fetcher = fetcherOf({});
    const r = await searchOtherTabs([], 'foo', {}, fetcher);
    expect(r).toEqual([]);
  });

  it('각 탭 본문에서 카운트 — 0 인 탭은 결과 제외 (FR-13)', async () => {
    const fetcher = fetcherOf({
      '/x/a.md': 'foo bar foo',
      '/x/b.md': 'baz qux',
      '/x/c.md': 'foo'
    });
    const r = await searchOtherTabs(TABS, 'foo', {}, fetcher);
    expect(r).toEqual([
      { tabId: 'a', fileName: 'a.md', count: 2 },
      { tabId: 'c', fileName: 'c.md', count: 1 }
    ]);
  });

  it('case-insensitive 기본', async () => {
    const fetcher = fetcherOf({ '/x/a.md': 'Foo FOO foo', '/x/b.md': '', '/x/c.md': '' });
    const r = await searchOtherTabs(TABS, 'foo', {}, fetcher);
    expect(r[0]!.count).toBe(3);
  });

  it('caseSensitive=true → 대소문자 구분', async () => {
    const fetcher = fetcherOf({ '/x/a.md': 'Foo FOO foo', '/x/b.md': '', '/x/c.md': '' });
    const r = await searchOtherTabs(TABS, 'foo', { caseSensitive: true }, fetcher);
    expect(r[0]!.count).toBe(1);
  });

  it('wholeWord=true → 단어 경계 강제', async () => {
    const fetcher = fetcherOf({ '/x/a.md': 'set setting subset set', '/x/b.md': '', '/x/c.md': '' });
    const r = await searchOtherTabs(TABS, 'set', { wholeWord: true }, fetcher);
    expect(r[0]!.count).toBe(2);
  });

  it('regex=true → 사용자 패턴 컴파일', async () => {
    const fetcher = fetcherOf({ '/x/a.md': 'a1 b22 c333', '/x/b.md': '', '/x/c.md': '' });
    const r = await searchOtherTabs(TABS, '\\d+', { regex: true }, fetcher);
    expect(r[0]!.count).toBe(3);
  });

  it('잘못된 regex → 빈 결과 (앱 크래시 X — PRD-007 SEC-01 동등)', async () => {
    const fetcher = fetcherOf({ '/x/a.md': 'anything', '/x/b.md': '', '/x/c.md': '' });
    const r = await searchOtherTabs(TABS, '(unclosed', { regex: true }, fetcher);
    expect(r).toEqual([]);
  });

  it('fetcher 실패한 탭은 결과에서 제외, 다른 탭은 영향 X (FR-09)', async () => {
    const fetcher = vi.fn(async (path: string) => {
      if (path === '/x/b.md') throw new Error('deleted');
      if (path === '/x/a.md') return 'foo foo';
      return 'foo';
    });
    const r = await searchOtherTabs(TABS, 'foo', {}, fetcher);
    expect(r).toEqual([
      { tabId: 'a', fileName: 'a.md', count: 2 },
      { tabId: 'c', fileName: 'c.md', count: 1 }
    ]);
  });

  it('병렬 fetcher 호출 — Promise.allSettled 로 한 탭의 hang 이 다른 탭 차단 X', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (path: string) => {
      calls.push(path);
      // 모두 같은 microtask 에서 시작됐는지 확인.
      return 'foo';
    });
    await searchOtherTabs(TABS, 'foo', {}, fetcher);
    // 3 탭 모두 호출됨 (순서는 보장 X).
    expect(calls.sort()).toEqual(['/x/a.md', '/x/b.md', '/x/c.md']);
  });

  it('FR-08: 모든 옵션 동시 — caseSensitive + wholeWord + regex', async () => {
    const fetcher = fetcherOf({
      '/x/a.md': 'def Define DEF def',
      '/x/b.md': '',
      '/x/c.md': ''
    });
    const r = await searchOtherTabs(
      TABS,
      'def',
      { caseSensitive: true, wholeWord: true, regex: false },
      fetcher
    );
    // wholeWord 'def' → 'def' (소문자) 단독만, 'def' (in 'Define') 는 wholeWord 위반,
    // 'DEF' 는 caseSensitive 로 제외. 결과: 2 (시작과 끝의 def).
    expect(r[0]!.count).toBe(2);
  });
});
