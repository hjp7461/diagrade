import type { Tab } from './state';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
}

export function TabBar({ tabs, activeTabId, onSwitch, onClose }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div role="tablist" aria-label="열린 문서" style={tabBarStyle}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            title={tab.filePath}
            onClick={() => onSwitch(tab.id)}
            style={{ ...tabStyle, ...(isActive ? activeTabStyle : {}) }}
          >
            <span style={tabLabelStyle}>{tab.fileName}</span>
            <button
              type="button"
              aria-label={`${tab.fileName} 닫기`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              style={closeButtonStyle}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  overflowX: 'auto',
  borderBottom: '1px solid #ddd',
  background: '#f7f7f7',
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: 13,
  userSelect: 'none'
};

const tabStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px 6px 12px',
  borderRight: '1px solid #ddd',
  cursor: 'default',
  maxWidth: 240,
  whiteSpace: 'nowrap'
};

const activeTabStyle: React.CSSProperties = {
  background: '#fff',
  fontWeight: 500,
  borderBottom: '2px solid #2b6cb0',
  marginBottom: -1
};

const tabLabelStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flex: 1
};

const closeButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: '0 4px',
  fontSize: 12,
  color: '#888',
  lineHeight: 1
};
