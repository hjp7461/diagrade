import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Tab } from '../tabs/state';
import { renderMarkdown } from './render';
import { applyHighlight } from './highlight';
import { scrollMatchIntoMain } from './scrollMatchIntoMain';
import { renderMermaidBlocks } from '../mermaid/render';
import { injectExportMenus } from '../export/menu';
import { saveAllDiagrams } from '../export/saveAllDiagrams';
import { svgToPngDataUrl } from '../export/svgToPngDataUrl';
import { suggestedPdfFileName } from '../export/suggestedFilename';
import { basenameOfPath } from '../path';
import {
  findMatches,
  chooseActiveIndex,
  clearHighlights,
  SEARCH_MATCH_ACTIVE_CLASS
} from '../search';
import { SearchBar } from '../search/SearchBar';
import type { EffectiveTheme } from '../theme/computeEffectiveTheme';
import type { PngScale } from '../../shared/types';

/** PRD-009: App 으로 lift 된 검색 세션. 탭 전환 시 보존. */
export interface SearchSession {
  open: boolean;
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  /** focus + select-all 트리거. 'open-search' 가 매번 증가. */
  focusTrigger: number;
}

export const initialSearchSession: SearchSession = {
  open: false,
  query: '',
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  focusTrigger: 0
};

interface MarkdownViewProps {
  tab: Tab;
  /** PRD-004: 활성 테마. 변경 시 mermaid 가 재렌더되도록 article key 에 포함. */
  theme: EffectiveTheme;
  /** PRD-006: ⬇ PNG export 배율. 변경 시 새 메뉴 생성. */
  pngScale: PngScale;
  /** PRD-009: App 으로 lift 된 검색 세션. */
  search: SearchSession;
  /** PRD-009: 부분 변경 dispatch — App 의 setSearch 와 호환. */
  onSearchChange: (partial: Partial<SearchSession>) => void;
  onNotify: (message: string) => void;
  /** PRD-011: ⤢ 확대보기 트리거. 정의 시 export 메뉴에 ⤢ 항목이 추가된다. */
  onZoomTrigger?: (svg: SVGElement, oneBasedIndex: number) => void;
}

const SEARCH_DEBOUNCE_MS = 150;

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
export function MarkdownView({
  tab,
  theme,
  pngScale,
  search,
  onSearchChange,
  onNotify,
  onZoomTrigger
}: MarkdownViewProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingScrollTopRef = useRef<number | null>(null);

  // 검색 매칭 결과는 DOM 의존이라 자체 state 로 유지 (App 으로 올릴 가치 없음).
  const [matchCount, setMatchCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  // 개별 setter alias — props 로 받은 onSearchChange 위에 얇은 래퍼.
  const setSearchQuery = useCallback(
    (q: string) => onSearchChange({ query: q }),
    [onSearchChange]
  );
  const setSearchCaseSensitive = useCallback(
    (v: boolean) => onSearchChange({ caseSensitive: v }),
    [onSearchChange]
  );
  const setSearchWholeWord = useCallback(
    (v: boolean) => onSearchChange({ wholeWord: v }),
    [onSearchChange]
  );
  const setSearchRegex = useCallback(
    (v: boolean) => onSearchChange({ regex: v }),
    [onSearchChange]
  );

  // 효과 안에서 최신 검색 state 참조 — props 변경에 반응하도록 ref sync.
  const searchStateRef = useRef(search);
  searchStateRef.current = search;

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
    // PRD-014: scrollIntoView 는 모든 scrollable ancestor 의 scrollTop 을 조정해
    // page 가 위로 끌려 올라가는 회귀가 있었음 (탭바 사라짐). main 의 scrollTop 만
    // 명시적으로 변경하는 helper 로 교체.
    const main = containerRef.current?.parentElement;
    if (!main) return;
    scrollMatchIntoMain(el, main);
  }, []);

  /**
   * 검색 실행 — 기존 하이라이트 제거 → 새 매칭 → 활성 결정 → scrollIntoView.
   * resetActive: true 이면 페이지 단위 결정 무시하고 0 으로 (FR-25 reload 후).
   */
  const runSearch = useCallback(
    (
      query: string,
      caseSensitive: boolean,
      wholeWord: boolean,
      regex: boolean,
      resetActive: boolean
    ): void => {
      const container = containerRef.current;
      if (!container) return;

      clearHighlights(container);
      matchElementsRef.current = [];

      if (query.length === 0) {
        setMatchCount(0);
        setActiveIndex(-1);
        return;
      }

      const matches = findMatches(container, query, { caseSensitive, wholeWord, regex });
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
        const s = searchStateRef.current;
        runSearch(q, s.caseSensitive, s.wholeWord, s.regex, false);
      }, SEARCH_DEBOUNCE_MS);
    },
    [runSearch, setSearchQuery]
  );

  const handleCaseToggle = useCallback((): void => {
    const s = searchStateRef.current;
    const next = !s.caseSensitive;
    setSearchCaseSensitive(next);
    runSearch(s.query, next, s.wholeWord, s.regex, false);
  }, [runSearch, setSearchCaseSensitive]);

  const handleWholeWordToggle = useCallback((): void => {
    const s = searchStateRef.current;
    const next = !s.wholeWord;
    setSearchWholeWord(next);
    runSearch(s.query, s.caseSensitive, next, s.regex, false);
  }, [runSearch, setSearchWholeWord]);

  const handleRegexToggle = useCallback((): void => {
    const s = searchStateRef.current;
    const next = !s.regex;
    setSearchRegex(next);
    runSearch(s.query, s.caseSensitive, s.wholeWord, next, false);
  }, [runSearch, setSearchRegex]);

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
    // PRD-007 FR-03: 닫을 때 토글 모두 reset. PRD-009: App 의 단일 dispatch 로 묶음.
    onSearchChange({
      open: false,
      query: '',
      caseSensitive: false,
      wholeWord: false,
      regex: false
    });
    setMatchCount(0);
    setActiveIndex(-1);
  }, [onSearchChange]);

  // ────────────────────────────────────────────────────────────────
  // mermaid / Shiki / export 메뉴 / 검색 재실행 (post-render)
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!html || !containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;
    void (async () => {
      await renderMermaidBlocks(container, theme);
      if (cancelled) return;
      await applyHighlight(container);
      if (cancelled) return;
      injectExportMenus(container, {
        activeTabPath: tab.filePath,
        pngScale,
        onZoomTrigger,
        // PRD-016: export 실패가 dialog 이후 침묵 사라지지 않도록 toast 발화.
        onError: onNotify
      });

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
        runSearch(s.query, s.caseSensitive, s.wholeWord, s.regex, /* resetActive */ true);
      } else {
        // html 이 바뀌면 ref 도 무효 — 다음 검색을 위해 비움.
        matchElementsRef.current = [];
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [html, tab.filePath, theme, pngScale, runSearch, onZoomTrigger]);

  // ────────────────────────────────────────────────────────────────
  // 메뉴 명령 수신 — close-tab/next-tab/prev-tab 은 App, 본문 관련은 여기서.
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return window.diagrade.events.onMenuCommand(async (command) => {
      if (command === 'save-all-diagrams' || command === 'save-all-diagrams-png') {
        const container = containerRef.current;
        if (!container) return;
        const format = command === 'save-all-diagrams-png' ? 'png' : 'svg';
        const result = await saveAllDiagrams(
          container,
          tab.filePath,
          {
            saveFile: window.diagrade.dialog.saveFile,
            writeText: window.diagrade.fs.writeText,
            writeBinary: window.diagrade.fs.writeBinary
          },
          { format, pngScale, svgToPng: svgToPngDataUrl }
        );
        if (result.noCharts) {
          onNotify('이 문서에는 다이어그램이 없습니다.');
        } else if (result.cancelledAt !== null) {
          onNotify(`${result.saved} 개 저장 후 취소되었습니다.`);
        } else if (result.failed > 0) {
          // PRD-016: 부분 실패 가시화.
          onNotify(`다이어그램 ${result.saved} 개 저장 / ${result.failed} 개 실패.`);
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
      }
      // 'open-search' 는 App 이 직접 처리 — 모든 탭에서 같은 검색 세션 공유.
    });
  }, [tab.filePath, onNotify, pngScale]);

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

  // PRD-018 회귀 가드: React 19 의 reconciliation 이 매 render 마다 새 `{__html}`
  // object 를 prop 변경으로 인식해 inner content 를 재적용 → 외부에서 inject 된
  // mermaid `<svg>` / 검색 `<mark>` 가 reset 되는 회귀. useMemo 로 reference 를
  // 안정화해 html string 이 동일한 동안 재적용 skip.
  const dangerousHtml = useMemo(() => ({ __html: html }), [html]);

  if (error) {
    return (
      <div className="diagrade-error-box" style={errorStyle} role="alert">
        <strong>파일을 읽을 수 없습니다:</strong> {error}
      </div>
    );
  }

  return (
    <>
      <article
        // PRD-004 FR-12: theme 변경 시 article 을 remount → mermaid 가 새 theme 로 재렌더.
        key={theme}
        ref={containerRef}
        className="diagrade-markdown"
        dangerouslySetInnerHTML={dangerousHtml}
        style={contentStyle}
      />
      {search.open && (
        <SearchBar
          query={search.query}
          caseSensitive={search.caseSensitive}
          wholeWord={search.wholeWord}
          regex={search.regex}
          currentIndex={activeIndex}
          totalMatches={matchCount}
          focusTrigger={search.focusTrigger}
          onQueryChange={handleQueryChange}
          onCaseToggle={handleCaseToggle}
          onWholeWordToggle={handleWholeWordToggle}
          onRegexToggle={handleRegexToggle}
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
  borderRadius: 4
  // color / background / border 는 theme.css 의 .diagrade-error-box 에서 관리.
};

const contentStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  lineHeight: 1.6,
  color: '#222'
};
