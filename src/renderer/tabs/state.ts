/**
 * Tab state — 순수 함수 컬렉션. PRD-001 §3.4.
 *
 * UI 와 분리되어 있어 단위 테스트로 FR-16~20 회귀를 방지한다.
 * 모든 mutator 는 새 객체를 반환 (React 의 reducer 와 호환).
 */
import { basenameOfPath } from '../path';

export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
}

export interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
}

export const emptyTabState: TabState = { tabs: [], activeTabId: null };

export interface OpenFilesResult {
  state: TabState;
  /** 새로 열린 탭 수 */
  opened: number;
  /** 최대 탭 한도 초과로 거부된 수 (FR-20) */
  skipped: number;
  /** 이미 열려있어서 포커스만 이동한 수 (FR-19) */
  reactivated: number;
}

/**
 * 여러 파일을 한 번에 연다. 각 path 에 대해:
 *   1) 이미 열린 탭이면 그쪽으로 포커스만 이동 (FR-19, 새 탭 생성 X)
 *   2) 한도 도달이면 skip + 카운트 (FR-20, 진행은 계속)
 *   3) 그 외 새 탭 생성 + 활성화
 *
 * 마지막으로 처리된 (열렸거나 reactivate 된) 파일이 활성 탭이 된다.
 * 모두 skip 된 경우 activeTabId 는 변경되지 않는다.
 */
export function openFiles(
  state: TabState,
  paths: string[],
  maxTabs: number,
  generateId: () => string
): OpenFilesResult {
  let s = state;
  let opened = 0;
  let skipped = 0;
  let reactivated = 0;

  for (const path of paths) {
    const existing = s.tabs.find((t) => t.filePath === path);
    if (existing) {
      s = { ...s, activeTabId: existing.id };
      reactivated++;
      continue;
    }
    if (s.tabs.length >= maxTabs) {
      skipped++;
      continue;
    }
    const id = generateId();
    const newTab: Tab = { id, filePath: path, fileName: basenameOfPath(path) };
    s = { tabs: [...s.tabs, newTab], activeTabId: id };
    opened++;
  }

  return { state: s, opened, skipped, reactivated };
}

/**
 * 탭을 닫고, 닫힌 탭이 활성이었다면 우측 이웃 → 좌측 이웃 → null 순으로 활성 위임.
 * 마지막 탭을 닫으면 activeTabId = null.
 */
export function closeTab(state: TabState, id: string): TabState {
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx === -1) return state;

  const newTabs = state.tabs.filter((t) => t.id !== id);
  if (newTabs.length === 0) {
    return { tabs: newTabs, activeTabId: null };
  }

  let nextActive: string | null = state.activeTabId;
  if (state.activeTabId === id) {
    // newTabs 에서 같은 idx 위치는 "닫힌 탭의 우측 이웃" (filter 로 한 칸 당겨짐).
    // 우측 이웃이 없으면 (마지막 탭이었음) 좌측 이웃으로.
    nextActive = newTabs[idx]?.id ?? newTabs[idx - 1]?.id ?? null;
  }
  return { tabs: newTabs, activeTabId: nextActive };
}

/**
 * 다음/이전 탭으로 활성 이동. 끝에서 wrap-around.
 * 활성 탭이 없으면 첫 탭을 활성화.
 */
export function switchTab(state: TabState, direction: 'next' | 'prev'): TabState {
  if (state.tabs.length === 0) return state;
  if (state.activeTabId === null) {
    return { ...state, activeTabId: state.tabs[0]!.id };
  }
  const idx = state.tabs.findIndex((t) => t.id === state.activeTabId);
  if (idx === -1) {
    return { ...state, activeTabId: state.tabs[0]!.id };
  }
  const delta = direction === 'next' ? 1 : -1;
  const len = state.tabs.length;
  const nextIdx = (idx + delta + len) % len;
  return { ...state, activeTabId: state.tabs[nextIdx]!.id };
}

export function setActiveTab(state: TabState, id: string): TabState {
  if (!state.tabs.some((t) => t.id === id)) return state;
  return { ...state, activeTabId: id };
}

