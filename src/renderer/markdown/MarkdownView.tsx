import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tab } from '../tabs/state';
import { renderMarkdown } from './render';
import { applyHighlight } from './highlight';
import { renderMermaidBlocks } from '../mermaid/render';
import { injectExportMenus } from '../export/menu';
import { saveAllDiagrams } from '../export/saveAllDiagrams';
import { suggestedPdfFileName } from '../export/suggestedFilename';
import { basenameOfPath } from '../path';
import {
  findMatches,
  chooseActiveIndex,
  clearHighlights,
  SEARCH_MATCH_ACTIVE_CLASS
} from '../search';
import { SearchBar } from '../search/SearchBar';

interface MarkdownViewProps {
  tab: Tab;
  onNotify: (message: string) => void;
}

const SEARCH_DEBOUNCE_MS = 150;

interface SearchState {
  open: boolean;
  query: string;
  caseSensitive: boolean;
}

/**
 * 활성 탭의 마크다운 본문 + 검색 (PRD-003).
 *
 * 흐름:
 *   1) fs.readText 로 파일 내용 로드
 *   2) renderMarkdown (markdown-it → 이미지 src 치환 → DOMPurify) — 동기
 *   3) DOMPurify 통과 결과만 mount (React 의 공식 escape hatch)
 *   4) mount 후 mermaid → Shiki → export 메뉴 주입 (모두 비동기)
 *   5) save-all-diagrams / export-pdf 메뉴 명령 수신
 *   6) PRD-002: app:file-changed 수신 → reload + scrollTop 보존
 *   7) PRD-002: app:file-missing 수신 → 토스트
 *   8) PRD-003: 검색 — 검색바 + 매칭 하이라이트 + 페이지 단위 active 결정
 */
export function MarkdownView({ tab, onNotify }: MarkdownViewProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingScrollTopRef = useRef<number | null>(null);

  // 검색 state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focusTrigger, setFocusTrigger] = useState(0);

  // 비-effect 코드에서 최신 검색 state 를 참조하기 위한 ref (post-render effect 의 의존성 회피).
  const searchStateRef = useRef<SearchState>({ open: false, query: '', caseSensitive: false });
  searchStateRef.current = {
    open: searchOpen,
    query: searchQuery,
    caseSensitive: searchCaseSensitive
  };

  // 매칭 element 배열 — 클래스 토글 / 스크롤에 사용. state 가 아닌 ref (re-render 안 트리거).
  const matchElementsRef = useRef<HTMLElement[]>([]);

  // query 디바운스 타이머.
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ────────────────────────────────────────────────────────────────
  // 파일 로드
  // ────────────────────────────────────────────────────────────────

  const loadFile = useCallback(() => {
    let cancelled = false;
    setError(null);

    window.diagrade.fs
      .readText(tab.filePath)
      .then(({ content }) => {
        if (cancelled) return;
        setHtml(renderMarkdown(content, tab.id));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [tab.filePath, tab.id]);

  useEffect(() => loadFile(), [loadFile]);

  // ────────────────────────────────────────────────────────────────
  // 검색 — 핵심 로직
  // ────────────────────────────────────────────────────────────────

  const applyActiveClass = useCallback((matches: HTMLElement[], idx: number): void => {
    matches.forEach((m, i) => {
      if (i === idx) m.classList.add(SEARCH_MATCH_ACTIVE_CLASS);
      else m.classList.remove(SEARCH_MATCH_ACTIVE_CLASS);
    });
  }, []);

  const scrollMatchIntoView = useCallback((el: HTMLElement): void => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  /**
   * 검색 실행 — 기존 하이라이트 제거 → 새 매칭 → 활성 결정 → scrollIntoView.
   * resetActive: true 이면 페이지 단위 결정 무시하고 0 으로 (FR-25 reload 후).
   */
  const runSearch = useCallback(
    (query: string, caseSensitive: boolean, resetActive: boolean): void => {
      const container = containerRef.current;
      if (!container) return;

      clearHighlights(container);
      matchElementsRef.current = [];

      if (query.length === 0) {
        setMatchCount(0);
        setActiveIndex(-1);
        return;
      }

      const matches = findMatches(container, query, caseSensitive);
      matchElementsRef.current = matches;
      setMatchCount(matches.length);

      if (matches.length === 0) {
        setActiveIndex(-1);
        return;
      }

      const main = container.parentElement;
      let idx: number;
      if (resetActive || !main) {
        idx = 0;
      } else {
        const tops = matches.map((m) => m.offsetTop);
        idx = chooseActiveIndex(tops, main.scrollTop, main.clientHeight);
      }
      setActiveIndex(idx);
      applyActiveClass(matches, idx);
      const activeEl = matches[idx];
      if (activeEl) scrollMatchIntoView(activeEl);
    },
    [applyActiveClass, scrollMatchIntoView]
  );

  const handleQueryChange = useCallback(
    (q: string): void => {
      setSearchQuery(q);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        runSearch(q, searchStateRef.current.caseSensitive, false);
      }, SEARCH_DEBOUNCE_MS);
    },
    [runSearch]
  );

  const handleCaseToggle = useCallback((): void => {
    const next = !searchCaseSensitive;
    setSearchCaseSensitive(next);
    runSearch(searchQuery, next, false);
  }, [runSearch, searchCaseSensitive, searchQuery]);

  const navigate = useCallback(
    (delta: 1 | -1): void => {
      const matches = matchElementsRef.current;
      if (matches.length === 0) return;
      const len = matches.length;
      setActiveIndex((prev) => {
        const next = (prev + delta + len) % len;
        applyActiveClass(matches, next);
        const el = matches[next];
        if (el) scrollMatchIntoView(el);
        return next;
      });
    },
    [applyActiveClass, scrollMatchIntoView]
  );

  const handleClose = useCallback((): void => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    const container = containerRef.current;
    if (container) clearHighlights(container);
    matchElementsRef.current = [];
    setSearchOpen(false);
    setSearchQuery('');
    setMatchCount(0);
    setActiveIndex(-1);
  }, []);

  // ────────────────────────────────────────────────────────────────
  // mermaid / Shiki / export 메뉴 / 검색 재실행 (post-render)
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!html || !containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;
    void (async () => {
      await renderMermaidBlocks(container);
      if (cancelled) return;
      await applyHighlight(container);
      if (cancelled) return;
      injectExportMenus(container, { activeTabPath: tab.filePath });

      // PRD-002 FR-04: scrollTop 복원.
      if (pendingScrollTopRef.current !== null) {
        const main = container.parentElement;
        if (main) main.scrollTop = pendingScrollTopRef.current;
        pendingScrollTopRef.current = null;
      }

      // PRD-003 FR-25: html 이 새로 mount 되면 매칭이 stale.
      // 검색바가 열려있고 query 가 있으면 새 DOM 에서 다시 찾는다. active = 0 reset.
      if (cancelled) return;
      const s = searchStateRef.current;
      if (s.open && s.query) {
        runSearch(s.query, s.caseSensitive, /* resetActive */ true);
      } else {
        // html 이 바뀌면 ref 도 무효 — 다음 검색을 위해 비움.
        matchElementsRef.current = [];
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [html, tab.filePath, runSearch]);

  // ────────────────────────────────────────────────────────────────
  // 메뉴 명령 수신 — close-tab/next-tab/prev-tab 은 App, 본문 관련은 여기서.
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return window.diagrade.events.onMenuCommand(async (command) => {
      if (command === 'save-all-diagrams') {
        const container = containerRef.current;
        if (!container) return;
        const result = await saveAllDiagrams(container, tab.filePath, {
          saveFile: window.diagrade.dialog.saveFile,
          writeText: window.diagrade.fs.writeText
        });
        if (result.noCharts) {
          onNotify('이 문서에는 다이어그램이 없습니다.');
        } else if (result.cancelledAt !== null) {
          onNotify(`${result.saved} 개 저장 후 취소되었습니다.`);
        } else {
          onNotify(`다이어그램 ${result.saved} 개를 저장했습니다.`);
        }
      } else if (command === 'export-pdf') {
        try {
          const path = await window.diagrade.print.pdf(suggestedPdfFileName(tab.filePath));
          if (path) onNotify(`PDF 저장됨: ${basenameOfPath(path)}`);
        } catch (e) {
          onNotify(`PDF 저장 실패: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else if (command === 'open-search') {
        // PRD-003 FR-01/02: 검색바 표시 (이미 열려있어도 focus + select-all 트리거).
        setSearchOpen(true);
        setFocusTrigger((t) => t + 1);
      }
    });
  }, [tab.filePath, onNotify]);

  // ────────────────────────────────────────────────────────────────
  // PRD-002: 파일 변경 / 삭제 이벤트 수신.
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const offChanged = window.diagrade.events.onFileChanged(() => {
      const main = containerRef.current?.parentElement;
      pendingScrollTopRef.current = main?.scrollTop ?? null;
      loadFile();
    });
    const offMissing = window.diagrade.events.onFileMissing((filename) => {
      onNotify(`파일이 삭제되었습니다: ${filename}`);
    });
    return () => {
      offChanged();
      offMissing();
    };
  }, [loadFile, onNotify]);

  // ────────────────────────────────────────────────────────────────
  // unmount 시 검색 정리 (탭 전환 — key remount 시).
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  if (error) {
    return (
      <div style={errorStyle} role="alert">
        <strong>파일을 읽을 수 없습니다:</strong> {error}
      </div>
    );
  }

  return (
    <>
      <article
        ref={containerRef}
        className="diagrade-markdown"
        dangerouslySetInnerHTML={{ __html: html }}
        style={contentStyle}
      />
      {searchOpen && (
        <SearchBar
          query={searchQuery}
          caseSensitive={searchCaseSensitive}
          currentIndex={activeIndex}
          totalMatches={matchCount}
          focusTrigger={focusTrigger}
          onQueryChange={handleQueryChange}
          onCaseToggle={handleCaseToggle}
          onPrev={() => navigate(-1)}
          onNext={() => navigate(1)}
          onClose={handleClose}
        />
      )}
    </>
  );
}

const errorStyle: React.CSSProperties = {
  padding: 16,
  color: '#c53030',
  background: '#fff5f5',
  border: '1px solid #fed7d7',
  borderRadius: 4
};

const contentStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  lineHeight: 1.6,
  color: '#222'
};
