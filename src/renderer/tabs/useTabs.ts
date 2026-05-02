import { useCallback, useRef, useState } from 'react';
import {
  openFiles,
  closeTab,
  switchTab,
  setActiveTab,
  emptyTabState,
  type TabState,
  type OpenFilesResult
} from './state';

const generateId = (): string => crypto.randomUUID();

export interface UseTabsApi {
  state: TabState;
  /** Open one or many file paths. Returns the result so caller can show messages. */
  openPaths: (paths: string[]) => OpenFilesResult;
  closeById: (id: string) => void;
  closeActive: () => void;
  switchTo: (direction: 'next' | 'prev') => void;
  setActiveById: (id: string) => void;
}

export function useTabs(maxTabs: number): UseTabsApi {
  const [state, setState] = useState<TabState>(emptyTabState);

  // openPaths 는 동기적으로 결과를 반환해야 하므로 ref 로 최신 state 참조.
  const stateRef = useRef(state);
  stateRef.current = state;
  const maxTabsRef = useRef(maxTabs);
  maxTabsRef.current = maxTabs;

  const openPaths = useCallback((paths: string[]): OpenFilesResult => {
    const result = openFiles(stateRef.current, paths, maxTabsRef.current, generateId);
    setState(result.state);
    return result;
  }, []);

  const closeById = useCallback((id: string) => {
    setState((s) => closeTab(s, id));
  }, []);

  const closeActive = useCallback(() => {
    setState((s) => (s.activeTabId ? closeTab(s, s.activeTabId) : s));
  }, []);

  const switchTo = useCallback((direction: 'next' | 'prev') => {
    setState((s) => switchTab(s, direction));
  }, []);

  const setActiveById = useCallback((id: string) => {
    setState((s) => setActiveTab(s, id));
  }, []);

  return { state, openPaths, closeById, closeActive, switchTo, setActiveById };
}
