import type { Tab } from './state';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
}

/**
 * 탭바. PRD-005 마이그레이션 — 색상 inline 제거 + CSS 클래스 사용.
 * Layout (display/flex/padding) 은 inline 유지.
 */
export function TabBar({ tabs, activeTabId, onSwitch, onClose }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div role="tablist" aria-label="열린 문서" className="diagrade-tab-bar" style={tabBarLayout}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            title={tab.filePath}
            onClick={() => onSwitch(tab.id)}
            className={'diagrade-tab' + (isActive ? ' is-active' : '')}
            style={tabLayout}
          >
            <span className="diagrade-tab-label" style={tabLabelLayout}>
              {tab.fileName}
            </span>
            <button
              type="button"
              aria-label={`${tab.fileName} 닫기`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className="diagrade-tab-close"
              style={closeButtonLayout}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

const tabBarLayout: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  overflowX: 'auto',
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: 13,
  userSelect: 'none'
};

const tabLayout: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px 6px 12px',
  cursor: 'default',
  maxWidth: 240,
  whiteSpace: 'nowrap'
};

const tabLabelLayout: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flex: 1
};

const closeButtonLayout: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: '0 4px',
  fontSize: 12,
  lineHeight: 1
};
