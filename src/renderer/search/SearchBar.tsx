import { useEffect, useRef, type KeyboardEvent } from 'react';

export interface SearchBarProps {
  query: string;
  caseSensitive: boolean;
  /** 0-based 활성 매칭 위치 (UI 에선 +1 표시). 매칭 0 개면 -1. */
  currentIndex: number;
  totalMatches: number;
  /** 부모가 'open-search' 를 다시 호출할 때마다 증가 — useEffect 가 focus + select 를 재트리거. */
  focusTrigger: number;
  onQueryChange: (q: string) => void;
  onCaseToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

/**
 * 검색바. PRD-003 §3.5 / FR-20~24.
 *
 * 키보드 (FR-03/04):
 *   - Esc: onClose
 *   - Enter: onNext
 *   - Shift+Enter: onPrev
 *
 * 마운트 시 입력란 자동 focus + 기존 query 가 있으면 select-all (FR-02).
 */
export function SearchBar({
  query,
  caseSensitive,
  currentIndex,
  totalMatches,
  focusTrigger,
  onQueryChange,
  onCaseToggle,
  onPrev,
  onNext,
  onClose
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 마운트 + focusTrigger 증가 시 focus + select-all (FR-02 + Cmd+F 재입력 동작).
    // query 변경에는 재실행 안 함 — input 의 value 를 직접 읽어 외부 props 의존성 회피.
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    if (el.value.length > 0) el.select();
  }, [focusTrigger]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (totalMatches === 0) return;
      if (e.shiftKey) onPrev();
      else onNext();
    }
  };

  const counterText =
    query.length === 0 ? '' : totalMatches === 0 ? '0/0' : `${currentIndex + 1}/${totalMatches}`;
  const counterEmpty = query.length > 0 && totalMatches === 0;
  const navDisabled = totalMatches === 0;

  return (
    <div className="diagrade-search-bar" role="search" aria-label="문서 검색">
      <input
        ref={inputRef}
        type="text"
        className="diagrade-search-bar__input"
        placeholder="검색어..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="검색어 입력"
      />

      <button
        type="button"
        className={
          'diagrade-search-bar__btn diagrade-search-bar__btn--toggle' +
          (caseSensitive ? ' is-active' : '')
        }
        onClick={onCaseToggle}
        aria-label="대소문자 구분"
        title="대소문자 구분"
        aria-pressed={caseSensitive}
      >
        Aa
      </button>

      <span
        className={
          'diagrade-search-bar__count' +
          (counterEmpty ? ' diagrade-search-bar__count--empty' : '')
        }
        aria-live="polite"
      >
        {counterText}
      </span>

      <button
        type="button"
        className="diagrade-search-bar__btn"
        onClick={onPrev}
        disabled={navDisabled}
        aria-label="이전 매칭"
        title="이전 매칭 (Shift+Enter)"
      >
        ▲
      </button>
      <button
        type="button"
        className="diagrade-search-bar__btn"
        onClick={onNext}
        disabled={navDisabled}
        aria-label="다음 매칭"
        title="다음 매칭 (Enter)"
      >
        ▼
      </button>

      <button
        type="button"
        className="diagrade-search-bar__btn diagrade-search-bar__close"
        onClick={onClose}
        aria-label="검색 닫기"
        title="검색 닫기 (Esc)"
      >
        ✕
      </button>
    </div>
  );
}
