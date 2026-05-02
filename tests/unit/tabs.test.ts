import { describe, it, expect } from 'vitest';
import {
  openFiles,
  closeTab,
  switchTab,
  setActiveTab,
  emptyTabState,
  type TabState
} from '../../src/renderer/tabs/state';

let counter = 0;
const idGen = () => `id-${++counter}`;
const resetId = () => {
  counter = 0;
};

describe('openFiles (FR-12, FR-19, FR-20)', () => {
  it('빈 상태에 단일 파일 추가', () => {
    resetId();
    const r = openFiles(emptyTabState, ['/x/a.md'], 5, idGen);
    expect(r.opened).toBe(1);
    expect(r.skipped).toBe(0);
    expect(r.reactivated).toBe(0);
    expect(r.state.tabs).toHaveLength(1);
    expect(r.state.tabs[0]).toMatchObject({ filePath: '/x/a.md', fileName: 'a.md' });
    expect(r.state.activeTabId).toBe(r.state.tabs[0]!.id);
  });

  it('FR-12: 다중 파일은 각각 탭으로', () => {
    resetId();
    const r = openFiles(emptyTabState, ['/x/a.md', '/x/b.md', '/x/c.md'], 10, idGen);
    expect(r.opened).toBe(3);
    expect(r.state.tabs.map((t) => t.fileName)).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('FR-19: 동일 파일 중복은 새 탭 생성 안 함, 기존 탭으로 포커스', () => {
    resetId();
    const first = openFiles(emptyTabState, ['/x/a.md', '/x/b.md'], 10, idGen);
    const aId = first.state.tabs[0]!.id;
    const second = openFiles(first.state, ['/x/a.md'], 10, idGen);
    expect(second.opened).toBe(0);
    expect(second.reactivated).toBe(1);
    expect(second.state.tabs).toHaveLength(2);
    expect(second.state.activeTabId).toBe(aId);
  });

  it('FR-20: 최대 탭 한도 초과는 가능한 만큼만 열고 나머지는 skip', () => {
    resetId();
    const r = openFiles(emptyTabState, ['/a', '/b', '/c', '/d'], 2, idGen);
    expect(r.opened).toBe(2);
    expect(r.skipped).toBe(2);
    expect(r.state.tabs).toHaveLength(2);
  });

  it('FR-20: 한도 도달 후에도 이미 열린 파일은 reactivate 가능', () => {
    resetId();
    const initial = openFiles(emptyTabState, ['/a', '/b'], 2, idGen);
    const r = openFiles(initial.state, ['/a', '/c'], 2, idGen);
    expect(r.opened).toBe(0);
    expect(r.reactivated).toBe(1); // /a
    expect(r.skipped).toBe(1); // /c
    expect(r.state.tabs).toHaveLength(2);
  });

  it('Windows 경로의 basename 추출', () => {
    resetId();
    const r = openFiles(emptyTabState, ['C:\\docs\\notes.md'], 5, idGen);
    expect(r.state.tabs[0]!.fileName).toBe('notes.md');
  });

  it('basename 만 있는 경로는 그대로 사용', () => {
    resetId();
    const r = openFiles(emptyTabState, ['nopath.md'], 5, idGen);
    expect(r.state.tabs[0]!.fileName).toBe('nopath.md');
  });
});

describe('closeTab (FR-17)', () => {
  function build(files: string[]): TabState {
    resetId();
    return openFiles(emptyTabState, files, 100, idGen).state;
  }

  it('비활성 탭 닫기는 활성 변경 없음', () => {
    const s = build(['/a', '/b', '/c']);
    const aId = s.tabs[0]!.id;
    const r = closeTab(s, aId);
    expect(r.tabs).toHaveLength(2);
    expect(r.activeTabId).toBe(s.activeTabId); // 마지막 c 가 여전히 활성
  });

  it('활성 탭 닫기는 우측 이웃을 활성화', () => {
    const s = build(['/a', '/b', '/c']);
    const middle: TabState = { ...s, activeTabId: s.tabs[1]!.id };
    const r = closeTab(middle, s.tabs[1]!.id);
    expect(r.tabs).toHaveLength(2);
    expect(r.activeTabId).toBe(s.tabs[2]!.id); // /c 가 활성으로
  });

  it('마지막 탭(활성)을 닫으면 좌측 이웃이 활성화', () => {
    const s = build(['/a', '/b', '/c']); // 활성 = c
    const cId = s.tabs[2]!.id;
    const r = closeTab(s, cId);
    expect(r.tabs).toHaveLength(2);
    expect(r.activeTabId).toBe(s.tabs[1]!.id);
  });

  it('단 하나 남은 탭을 닫으면 activeTabId = null', () => {
    const s = build(['/a']);
    const r = closeTab(s, s.tabs[0]!.id);
    expect(r.tabs).toHaveLength(0);
    expect(r.activeTabId).toBeNull();
  });

  it('존재하지 않는 id 닫기는 no-op', () => {
    const s = build(['/a']);
    const r = closeTab(s, 'nonexistent');
    expect(r).toBe(s);
  });
});

describe('switchTab (FR-18)', () => {
  function build(files: string[]): TabState {
    resetId();
    return openFiles(emptyTabState, files, 100, idGen).state;
  }

  it('next 는 다음 탭으로 이동', () => {
    const s = build(['/a', '/b', '/c']);
    const middle: TabState = { ...s, activeTabId: s.tabs[1]!.id };
    expect(switchTab(middle, 'next').activeTabId).toBe(s.tabs[2]!.id);
  });

  it('prev 는 이전 탭으로 이동', () => {
    const s = build(['/a', '/b', '/c']);
    const middle: TabState = { ...s, activeTabId: s.tabs[1]!.id };
    expect(switchTab(middle, 'prev').activeTabId).toBe(s.tabs[0]!.id);
  });

  it('마지막에서 next 는 처음으로 wrap-around', () => {
    const s = build(['/a', '/b', '/c']); // 활성 = c
    expect(switchTab(s, 'next').activeTabId).toBe(s.tabs[0]!.id);
  });

  it('처음에서 prev 는 마지막으로 wrap-around', () => {
    const s = build(['/a', '/b', '/c']);
    const first: TabState = { ...s, activeTabId: s.tabs[0]!.id };
    expect(switchTab(first, 'prev').activeTabId).toBe(s.tabs[2]!.id);
  });

  it('빈 상태에서 switch 는 no-op', () => {
    expect(switchTab(emptyTabState, 'next')).toEqual(emptyTabState);
  });

  it('탭은 있으나 active 가 null 이면 첫 탭 활성화', () => {
    const s = build(['/a', '/b']);
    const noActive: TabState = { ...s, activeTabId: null };
    expect(switchTab(noActive, 'next').activeTabId).toBe(s.tabs[0]!.id);
  });
});

describe('setActiveTab', () => {
  it('존재하는 id 는 활성 변경', () => {
    resetId();
    const s = openFiles(emptyTabState, ['/a', '/b'], 5, idGen).state;
    expect(setActiveTab(s, s.tabs[0]!.id).activeTabId).toBe(s.tabs[0]!.id);
  });

  it('존재하지 않는 id 는 no-op', () => {
    resetId();
    const s = openFiles(emptyTabState, ['/a'], 5, idGen).state;
    const r = setActiveTab(s, 'nonexistent');
    expect(r).toBe(s);
  });
});
