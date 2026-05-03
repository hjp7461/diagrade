/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { SettingsDialog } from '../../src/renderer/settings/SettingsDialog';
import type { Config } from '../../src/shared/types';

// React 18 의 act 가 jsdom 환경에서 warning 없이 동작하도록.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BASE_CONFIG: Config = {
  maxTabs: 20,
  liveReload: true,
  theme: 'auto',
  pngScale: 2
};

let container: HTMLDivElement;
let root: Root;

function mount(props: Parameters<typeof SettingsDialog>[0]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<SettingsDialog {...props} />);
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

/**
 * React controlled input 의 value 를 변경한 후 onChange 를 발화하려면
 * native InputElement 의 setter 를 우회해서 React 가 변경을 감지하게 해야 한다.
 * (React 18 의 controlled input 디자인 — props.value === el.value 면 onChange skip.)
 */
function setNativeInputValue(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
}

function setNativeChecked(el: HTMLInputElement, checked: boolean): void {
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'checked')?.set;
  setter?.call(el, checked);
}

describe('SettingsDialog (PRD-010)', () => {
  it('FR-09~12: props 의 config 값을 4 항목 모두 정확히 표시', () => {
    mount({ config: BASE_CONFIG, onChange: vi.fn(), onClose: vi.fn() });

    const maxTabs = container.querySelector<HTMLInputElement>('input[type=number]')!;
    expect(maxTabs.valueAsNumber).toBe(20);

    const liveReload = container.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    expect(liveReload.checked).toBe(true);

    const themeAuto = container.querySelector<HTMLInputElement>('input[type=radio][value=auto]')!;
    expect(themeAuto.checked).toBe(true);

    const pngScale = container.querySelector<HTMLSelectElement>('select')!;
    expect(pngScale.value).toBe('2');
  });

  it('FR-09: maxTabs 변경 → onChange 가 정확한 partial 로 호출, 클램프 적용 (51 → 50)', () => {
    const onChange = vi.fn();
    mount({ config: BASE_CONFIG, onChange, onClose: vi.fn() });
    const input = container.querySelector<HTMLInputElement>('input[type=number]')!;

    act(() => {
      setNativeInputValue(input, '51');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({ maxTabs: 50 });

    onChange.mockClear();
    act(() => {
      setNativeInputValue(input, '0');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({ maxTabs: 1 });
  });

  it('FR-10: liveReload 토글 → onChange({liveReload})', () => {
    const onChange = vi.fn();
    mount({ config: BASE_CONFIG, onChange, onClose: vi.fn() });
    const cb = container.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    act(() => {
      setNativeChecked(cb, false);
      cb.dispatchEvent(new Event('click', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({ liveReload: false });
  });

  it('FR-11: theme 라디오 변경 → onChange({theme})', () => {
    const onChange = vi.fn();
    mount({ config: BASE_CONFIG, onChange, onClose: vi.fn() });
    const dark = container.querySelector<HTMLInputElement>('input[type=radio][value=dark]')!;
    act(() => {
      dark.click();
    });
    expect(onChange).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('FR-12: pngScale 변경 → onChange({pngScale}) — 숫자 캐스트', () => {
    const onChange = vi.fn();
    mount({ config: BASE_CONFIG, onChange, onClose: vi.fn() });
    const select = container.querySelector<HTMLSelectElement>('select')!;
    act(() => {
      setNativeInputValue(select, '4');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({ pngScale: 4 });
  });

  it('FR-07: X 버튼 → onClose', () => {
    const onClose = vi.fn();
    mount({ config: BASE_CONFIG, onChange: vi.fn(), onClose });
    const closeBtn = container.querySelector<HTMLButtonElement>('.diagrade-settings-dialog__close')!;
    act(() => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('FR-07: Esc → onClose', () => {
    const onClose = vi.fn();
    mount({ config: BASE_CONFIG, onChange: vi.fn(), onClose });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('FR-07: backdrop 클릭 → onClose. 모달 내부 클릭은 닫지 않음', () => {
    const onClose = vi.fn();
    mount({ config: BASE_CONFIG, onChange: vi.fn(), onClose });
    const backdrop = container.querySelector<HTMLDivElement>('.diagrade-settings-backdrop')!;
    const dialog = container.querySelector<HTMLDivElement>('.diagrade-settings-dialog')!;

    // 모달 내부 클릭 → onClose 호출 X
    act(() => {
      dialog.click();
    });
    expect(onClose).not.toHaveBeenCalled();

    // backdrop 직접 클릭 → onClose 호출
    act(() => {
      backdrop.click();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('잘못된 pngScale 값 (5) → onChange 호출 안 됨 (방어)', () => {
    const onChange = vi.fn();
    mount({ config: BASE_CONFIG, onChange, onClose: vi.fn() });
    const select = container.querySelector<HTMLSelectElement>('select')!;
    // select 의 옵션에 없는 값을 강제 dispatch — 방어 분기 검증
    act(() => {
      // option list 에 없는 값을 setter 로 강제 — DOM 상으론 빈값이 될 수 있음
      Object.defineProperty(select, 'value', { get: () => '5', configurable: true });
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
