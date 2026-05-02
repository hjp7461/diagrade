import { useEffect, useRef, useState } from 'react';
import { TabBar } from './tabs/TabBar';
import { useTabs } from './tabs/useTabs';
import { resolveDrop } from './dnd';
import { useNotifications, NotificationStack } from './notifications';
import { MarkdownView } from './markdown/MarkdownView';
import { dirnameOfPath } from './path';
import type { Tab } from './tabs/state';
import type { ThemeSetting } from '../shared/types';
import { useTheme } from './theme/useTheme';

const DEFAULT_MAX_TABS = 20;
const DEFAULT_THEME: ThemeSetting = 'auto';

export function App() {
  const [maxTabs, setMaxTabs] = useState(DEFAULT_MAX_TABS);
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>(DEFAULT_THEME);
  const effectiveTheme = useTheme(themeSetting);
  const tabs = useTabs(maxTabs);
  const notifications = useNotifications();

  // FR-38/41 + PRD-004 FR-01: config 로드. 실패해도 기본값으로 동작.
  useEffect(() => {
    void window.diagrade.config.get().then((cfg) => {
      setMaxTabs(cfg.maxTabs);
      setThemeSetting(cfg.theme);
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
            onNotify={notifications.push}
          />
        ) : (
          <EmptyState />
        )}
      </main>
      <NotificationStack items={notifications.items} onDismiss={notifications.dismiss} />
    </div>
  );
}

function EmptyState() {
  return (
    <div style={emptyStyle}>
      <h1 style={{ marginBottom: 8 }}>Diagrade</h1>
      <p style={{ color: '#666' }}>
        마크다운 파일을 창에 끌어다 놓거나 <kbd>{cmdLabel()}+O</kbd> 로 여세요.
      </p>
      <p style={{ color: '#666', fontSize: 13, marginTop: 16 }}>
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
  padding: 24,
  background: '#fff'
};

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: '#333',
  textAlign: 'center'
};



