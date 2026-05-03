import type { OtherTabResult } from './searchOtherTabs';

/**
 * PRD-009 FR-10/11/12: 검색바 아래에 비활성 탭 매칭 결과 패널.
 * 매칭이 있는 탭만 항목으로 표시, 클릭 시 onJump.
 */

export interface OtherTabsPanelProps {
  results: OtherTabResult[];
  onJump: (tabId: string) => void;
}

export function OtherTabsPanel({ results, onJump }: OtherTabsPanelProps) {
  if (results.length === 0) return null;

  return (
    <div
      className="diagrade-search-other-tabs"
      role="list"
      aria-label="다른 탭의 검색 결과"
    >
      <div className="diagrade-search-other-tabs__header">다른 탭</div>
      {results.map((r) => (
        <button
          key={r.tabId}
          type="button"
          className="diagrade-search-other-tabs__item"
          role="listitem"
          onClick={() => onJump(r.tabId)}
          title={`${r.fileName} 으로 이동 (${r.count} 개 매칭)`}
        >
          <span className="diagrade-search-other-tabs__name">{r.fileName}</span>
          <span className="diagrade-search-other-tabs__count">{r.count}</span>
        </button>
      ))}
    </div>
  );
}
