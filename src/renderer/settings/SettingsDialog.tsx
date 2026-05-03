import { useEffect, useRef } from 'react';
import type { Config, ThemeSetting, PngScale } from '../../shared/types';

/**
 * PRD-010: 설정 모달.
 *
 * 4 항목 (maxTabs, liveReload, theme, pngScale) 을 GUI 로 편집.
 * 모든 변경은 즉시 onChange — App 이 ConfigStore.set 호출 + state 갱신.
 *
 * 닫기: X 버튼, Esc, backdrop 클릭. 모두 동일하게 onClose.
 */

const MAX_TABS_LOWER = 1;
const MAX_TABS_UPPER = 50;
const PNG_SCALES: readonly PngScale[] = [1, 2, 3, 4] as const;
const THEME_OPTIONS: readonly { value: ThemeSetting; label: string }[] = [
  { value: 'auto', label: '자동 (시스템)' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' }
] as const;

export interface SettingsDialogProps {
  config: Config;
  onChange: (partial: Partial<Config>) => void;
  onClose: () => void;
}

export function SettingsDialog({ config, onChange, onClose }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // FR-07: Esc 닫기. window 캡처 단계로 등록 — 본문 / 검색바 keydown 보다 먼저.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  // 모달 열릴 때 첫 입력란 focus.
  useEffect(() => {
    const first = dialogRef.current?.querySelector<HTMLElement>('input, select, button');
    first?.focus();
  }, []);

  const onMaxTabsChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = e.target.valueAsNumber;
    if (!Number.isFinite(v) || !Number.isInteger(v)) return;
    const clamped = Math.max(MAX_TABS_LOWER, Math.min(MAX_TABS_UPPER, v));
    onChange({ maxTabs: clamped });
  };

  const onLiveReloadChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onChange({ liveReload: e.target.checked });
  };

  const onThemeChange = (theme: ThemeSetting): void => {
    onChange({ theme });
  };

  const onPngScaleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const v = Number(e.target.value);
    if (PNG_SCALES.includes(v as PngScale)) {
      onChange({ pngScale: v as PngScale });
    }
  };

  return (
    <div
      className="diagrade-settings-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="설정"
      onClick={(e) => {
        // FR-07: backdrop 클릭으로 닫기. 모달 내부 클릭은 stopPropagation 으로 차단.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="diagrade-settings-dialog" ref={dialogRef}>
        <div className="diagrade-settings-dialog__header">
          <h2 className="diagrade-settings-dialog__title">설정</h2>
          <button
            type="button"
            className="diagrade-settings-dialog__close"
            onClick={onClose}
            aria-label="설정 닫기"
            title="닫기 (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="diagrade-settings-dialog__body">
          <label className="diagrade-settings-row">
            <span className="diagrade-settings-row__label">최대 탭 수</span>
            <input
              type="number"
              className="diagrade-settings-row__input"
              min={MAX_TABS_LOWER}
              max={MAX_TABS_UPPER}
              step={1}
              value={config.maxTabs}
              onChange={onMaxTabsChange}
              aria-label="최대 탭 수"
            />
          </label>

          <label className="diagrade-settings-row">
            <span className="diagrade-settings-row__label">파일 변경 시 자동 새로고침</span>
            <input
              type="checkbox"
              className="diagrade-settings-row__checkbox"
              checked={config.liveReload}
              onChange={onLiveReloadChange}
              aria-label="파일 변경 시 자동 새로고침"
            />
          </label>

          <fieldset className="diagrade-settings-row">
            <legend className="diagrade-settings-row__label">테마</legend>
            <div className="diagrade-settings-row__radios">
              {THEME_OPTIONS.map((opt) => (
                <label key={opt.value} className="diagrade-settings-radio">
                  <input
                    type="radio"
                    name="diagrade-theme"
                    value={opt.value}
                    checked={config.theme === opt.value}
                    onChange={() => onThemeChange(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="diagrade-settings-row">
            <span className="diagrade-settings-row__label">PNG 내보내기 배율</span>
            <select
              className="diagrade-settings-row__select"
              value={config.pngScale}
              onChange={onPngScaleChange}
              aria-label="PNG 내보내기 배율"
            >
              {PNG_SCALES.map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="diagrade-settings-dialog__footer">
          <small className="diagrade-settings-dialog__hint">변경은 즉시 저장됩니다.</small>
        </div>
      </div>
    </div>
  );
}

export const __test__ = {
  MAX_TABS_LOWER,
  MAX_TABS_UPPER,
  PNG_SCALES,
  THEME_OPTIONS
};
