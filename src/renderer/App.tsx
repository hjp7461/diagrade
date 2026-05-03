import { useCallback, useEffect, useRef, useState } from 'react';
import { TabBar } from './tabs/TabBar';
import { useTabs } from './tabs/useTabs';
import { resolveDrop } from './dnd';
import { useNotifications, NotificationStack } from './notifications';
import {
  MarkdownView,
  initialSearchSession,
  type SearchSession
} from './markdown/MarkdownView';
import { dirnameOfPath } from './path';
import type { Tab } from './tabs/state';
import type { ThemeSetting, PngScale } from '../shared/types';
import { useTheme } from './theme/useTheme';
import { searchOtherTabs, type OtherTabResult } from './search/searchOtherTabs';
import { OtherTabsPanel } from './search/OtherTabsPanel';
import { SettingsDialog } from './settings/SettingsDialog';
import type { Config } from '../shared/types';

const DEFAULT_MAX_TABS = 20;
const DEFAULT_THEME: ThemeSetting = 'auto';
const DEFAULT_PNG_SCALE: PngScale = 2;
const DEFAULT_LIVE_RELOAD = true;

export function App() {
  const [maxTabs, setMaxTabs] = useState(DEFAULT_MAX_TABS);
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>(DEFAULT_THEME);
  const [pngScale, setPngScale] = useState<PngScale>(DEFAULT_PNG_SCALE);
  const [liveReload, setLiveReload] = useState<boolean>(DEFAULT_LIVE_RELOAD);
  const effectiveTheme = useTheme(themeSetting);
  const tabs = useTabs(maxTabs);
  const notifications = useNotifications();

  // PRD-009: 검색 세션. App 으로 lift — 탭 전환 시 query 보존.
  const [search, setSearch] = useState<SearchSession>(initialSearchSession);
  const updateSearch = useCallback((partial: Partial<SearchSession>) => {
    setSearch((prev) => ({ ...prev, ...partial }));
  }, []);

  // PRD-009 §6.4: 비활성 탭 cache. tabId → raw text. file-changed/검색 닫기 시 무효화.
  const otherTabsCacheRef = useRef<Map<string, string>>(new Map());
  const [otherResults, setOtherResults] = useState<OtherTabResult[]>([]);

  // PRD-010: 설정 모달 toggle. 모달은 단일 mount 라 portal 불필요.
  const [settingsOpen, setSettingsOpen] = useState(false);

  // FR-38/41 + PRD-004 FR-01 + PRD-006 FR-01 + PRD-010: config 로드. 실패해도 기본값으로 동작.
  useEffect(() => {
    void window.diagrade.config.get().then((cfg) => {
      setMaxTabs(cfg.maxTabs);
      setThemeSetting(cfg.theme);
      setPngScale(cfg.pngScale);
      setLiveReload(cfg.liveReload);
    });
  }, []);

  // 메뉴 / 다이얼로그로 열린 파일을 탭에 추가.
  useEffect(() => {
    return window.diagrade.events.onFilesOpened((paths) => {
      const result = tabs.openPaths(paths);
      if (result.skipped > 0) {
        // FR-20 형식: "최대 {N} 개의 파일만 열 수 있습니다. {M} 개의 파일을 열었습니다."
        notifications.push(
          `최대 ${maxTabs} 개의 파일만 열 수 있습니다. ${result.opened} 개의 파일을 열었습니다.`
        );
      }
    });
  }, [tabs, notifications, maxTabs]);

  // 메뉴 명령 (Cmd/Ctrl+W 등) 처리.
  useEffect(() => {
    return window.diagrade.events.onMenuCommand((command) => {
      switch (command) {
        case 'close-tab':
          tabs.closeActive();
          break;
        case 'next-tab':
          tabs.switchTo('next');
          break;
        case 'prev-tab':
          tabs.switchTo('prev');
          break;
        case 'open-search':
          // PRD-009 FR-03: 검색 세션은 App 소유 — 탭에 무관하게 한 번에 처리.
          setSearch((prev) => ({
            ...prev,
            open: true,
            focusTrigger: prev.focusTrigger + 1
          }));
          break;
        case 'open-settings':
          // PRD-010 FR-07: 토글 — 같은 메뉴 재실행 시 닫힘.
          setSettingsOpen((v) => !v);
          break;
      }
    });
  }, [tabs]);

  // FR-18: Ctrl+Tab / Ctrl+Shift+Tab. 메뉴가 아닌 keydown 으로 처리.
  // (Tab 키는 macOS 메뉴 가속기로 잘 안 매핑되고, 브라우저식 단축키는 renderer 에서 받는 게 자연스러움.)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      tabs.switchTo(e.shiftKey ? 'prev' : 'next');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tabs]);

  // SEC-06 / §5.2: 활성/비활성 탭의 디렉터리를 main 의 protocol 화이트리스트에 동기화.
  // PRD-002 §3.1 FR-05: 화이트리스트 갱신 직후 watch:set-active-path 를 같은 effect 에서 호출
  // (renderer→main IPC 는 큐 순서 보장 — registerTabDir 가 watch 검증 시점에 반영됨).
  // 자식 (MarkdownView) 의 effect 보다 watch 호출이 먼저 가야 race 방지.
  const prevTabsRef = useRef<Tab[]>([]);
  useEffect(() => {
    const prev = prevTabsRef.current;
    const current = tabs.state.tabs;

    for (const t of current) {
      if (!prev.find((p) => p.id === t.id)) {
        void window.diagrade.protocol.registerTabDir(t.id, dirnameOfPath(t.filePath));
      }
    }
    for (const t of prev) {
      if (!current.find((c) => c.id === t.id)) {
        void window.diagrade.protocol.unregisterTabDir(t.id);
      }
    }

    // 활성 탭의 path 로 watcher 전환. 활성 탭 없으면 null 로 stop.
    const active = current.find((t) => t.id === tabs.state.activeTabId) ?? null;
    void window.diagrade.watch.setActivePath(active?.filePath ?? null);

    prevTabsRef.current = current;
  }, [tabs.state.tabs, tabs.state.activeTabId]);

  // PRD-009 §6.4/§6.5: 비활성 탭 cache 무효화 — file-changed 시 + 검색 닫기 시 모두.
  useEffect(() => {
    if (!search.open) {
      otherTabsCacheRef.current.clear();
      setOtherResults([]);
    }
  }, [search.open]);

  useEffect(() => {
    return window.diagrade.events.onFileChanged(() => {
      // 어떤 파일이 변했는지 모르므로 보수적으로 전체 클리어. 다음 검색에서 재 fetch.
      otherTabsCacheRef.current.clear();
    });
  }, []);

  // PRD-009 FR-04~FR-09: 비활성 탭 raw text 검색.
  useEffect(() => {
    if (!search.open || search.query.length === 0) {
      setOtherResults([]);
      return;
    }
    const inactive = tabs.state.tabs.filter((t) => t.id !== tabs.state.activeTabId);
    const cache = otherTabsCacheRef.current;
    const fetcher = async (path: string): Promise<string> => {
      const cached = cache.get(path);
      if (cached !== undefined) return cached;
      const { content } = await window.diagrade.fs.readText(path);
      cache.set(path, content);
      return content;
    };
    let cancelled = false;
    void searchOtherTabs(
      inactive.map((t) => ({ id: t.id, filePath: t.filePath, fileName: t.fileName })),
      search.query,
      {
        caseSensitive: search.caseSensitive,
        wholeWord: search.wholeWord,
        regex: search.regex
      },
      fetcher
    ).then((results) => {
      if (cancelled) return;
      setOtherResults(results);
    });
    return () => {
      cancelled = true;
    };
  }, [
    search.open,
    search.query,
    search.caseSensitive,
    search.wholeWord,
    search.regex,
    tabs.state.tabs,
    tabs.state.activeTabId
  ]);

  const handleJumpToTab = useCallback(
    (tabId: string) => {
      tabs.setActiveById(tabId);
      // 새 활성 탭의 MarkdownView 가 mount 되면 post-render effect 가 search.query 로 자동 재검색.
    },
    [tabs]
  );

  // PRD-010 FR-13/14: 설정 변경 → ConfigStore.set → 응답값으로 React state sync.
  // ConfigStore 가 validateConfig 을 거치므로 잘못된 값은 마지막 유효값으로 reject 됨.
  const handleSettingsChange = useCallback(
    (partial: Partial<Config>) => {
      void window.diagrade.config
        .set(partial)
        .then((cfg) => {
          setMaxTabs(cfg.maxTabs);
          setThemeSetting(cfg.theme);
          setPngScale(cfg.pngScale);
          setLiveReload(cfg.liveReload);
          // liveReload 는 main 의 watcher 가 다음 watch:set-active-path 호출 시 즉시 반영.
        })
        .catch((e: unknown) => {
          notifications.push(
            `설정 저장 실패: ${e instanceof Error ? e.message : String(e)}`
          );
        });
    },
    [notifications]
  );

  const currentConfig: Config = {
    maxTabs,
    liveReload,
    theme: themeSetting,
    pngScale
  };

  // FR-10/11/12/13: 드래그앤드롭.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      const result = await resolveDrop(e.dataTransfer, {
        getPathForFile: (f) => window.diagrade.platform.getPathForFile(f),
        listMd: (folder) => window.diagrade.fs.listMd(folder)
      });
      for (const filename of result.unsupported) {
        // FR-11
        notifications.push(`지원하지 않는 파일 형식입니다: ${filename}`);
      }
      if (result.paths.length > 0) {
        const opened = tabs.openPaths(result.paths);
        if (opened.skipped > 0) {
          notifications.push(
            `최대 ${maxTabs} 개의 파일만 열 수 있습니다. ${opened.opened} 개의 파일을 열었습니다.`
          );
        }
      }
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [tabs, notifications, maxTabs]);

  const activeTab = tabs.state.tabs.find((t) => t.id === tabs.state.activeTabId) ?? null;

  return (
    <div style={appStyle}>
      <TabBar
        tabs={tabs.state.tabs}
        activeTabId={tabs.state.activeTabId}
        onSwitch={tabs.setActiveById}
        onClose={tabs.closeById}
      />
      <main className="diagrade-content-main" style={mainStyle}>
        {activeTab ? (
          <MarkdownView
            key={activeTab.id}
            tab={activeTab}
            theme={effectiveTheme}
            pngScale={pngScale}
            search={search}
            onSearchChange={updateSearch}
            onNotify={notifications.push}
          />
        ) : (
          <EmptyState />
        )}
      </main>
      {search.open && (
        <OtherTabsPanel results={otherResults} onJump={handleJumpToTab} />
      )}
      {settingsOpen && (
        <SettingsDialog
          config={currentConfig}
          onChange={handleSettingsChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      <NotificationStack items={notifications.items} onDismiss={notifications.dismiss} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="diagrade-empty-state" style={emptyStyle}>
      <h1 style={{ marginBottom: 8 }}>Diagrade</h1>
      <p className="diagrade-empty-primary">
        마크다운 파일을 창에 끌어다 놓거나 <kbd>{cmdLabel()}+O</kbd> 로 여세요.
      </p>
      <p className="diagrade-empty-muted" style={{ fontSize: 13, marginTop: 16 }}>
        폴더를 끌어다 놓으면 1-depth 의 마크다운만 자동으로 탭으로 열립니다.
      </p>
    </div>
  );
}

function cmdLabel(): string {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('mac') ? 'Cmd' : 'Ctrl';
}

const appStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 24
  // background 는 theme.css 의 main.diagrade-content-main 에서 관리.
};

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  textAlign: 'center'
  // color / background 는 theme.css 의 .diagrade-empty-state 에서 관리.
};



