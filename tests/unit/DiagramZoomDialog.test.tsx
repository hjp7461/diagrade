/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import {
  DiagramZoomDialog,
  type DiagramZoomDialogProps,
  type ZoomDialogArgs,
  type ExportDeps
} from '../../src/renderer/components/DiagramZoomDialog';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function makeSvg(viewBox = '0 0 200 100'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  return svg as unknown as SVGSVGElement;
}

function makeArgs(over: Partial<ZoomDialogArgs> = {}): ZoomDialogArgs {
  return {
    svgNode: makeSvg(),
    index: 1,
    activeTabPath: '/some/dir/notes.md',
    pngScale: 2,
    ...over
  };
}

function makeExportDeps(): ExportDeps & {
  saveFileMock: ReturnType<typeof vi.fn>;
  writeTextMock: ReturnType<typeof vi.fn>;
  writeBinaryMock: ReturnType<typeof vi.fn>;
  serializeMock: ReturnType<typeof vi.fn>;
  svgToPngMock: ReturnType<typeof vi.fn>;
} {
  const saveFileMock = vi.fn().mockResolvedValue('/out/notes-1.png');
  const writeTextMock = vi.fn().mockResolvedValue(undefined);
  const writeBinaryMock = vi.fn().mockResolvedValue(undefined);
  const serializeMock = vi.fn().mockReturnValue('<svg/>');
  const svgToPngMock = vi.fn().mockResolvedValue('data:image/png;base64,QUJD');
  return {
    saveFile: saveFileMock,
    writeText: writeTextMock,
    writeBinary: writeBinaryMock,
    serialize: serializeMock,
    svgToPng: svgToPngMock,
    saveFileMock,
    writeTextMock,
    writeBinaryMock,
    serializeMock,
    svgToPngMock
  };
}

function mount(props: DiagramZoomDialogProps): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<DiagramZoomDialog {...props} />);
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.body.style.overflow = '';
});

describe('DiagramZoomDialog (PRD-011)', () => {
  it('args === null → 렌더 안 됨', () => {
    mount({ args: null, onClose: vi.fn() });
    expect(container.querySelector('.diagrade-zoom-dialog')).toBeNull();
  });

  it('args 전달 시 dialog + toolbar 렌더', () => {
    mount({ args: makeArgs(), onClose: vi.fn() });
    expect(container.querySelector('.diagrade-zoom-dialog')).not.toBeNull();
    expect(container.querySelector('.diagrade-zoom-dialog__toolbar')).not.toBeNull();
    expect(container.querySelector('.diagrade-zoom-dialog__close')).not.toBeNull();
  });

  it('FR-09: 열림 동안 body overflow=hidden, 닫으면 복원', () => {
    document.body.style.overflow = 'auto';
    mount({ args: makeArgs(), onClose: vi.fn() });
    expect(document.body.style.overflow).toBe('hidden');
    act(() => {
      root.unmount();
    });
    expect(document.body.style.overflow).toBe('auto');
    // afterEach 의 두 번째 unmount 가 throw 하지 않도록 root 재마운트
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it('FR-07: ESC → onClose', () => {
    const onClose = vi.fn();
    mount({ args: makeArgs(), onClose });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('FR-06: ✕ 버튼 → onClose', () => {
    const onClose = vi.fn();
    mount({ args: makeArgs(), onClose });
    const closeBtn = container.querySelector<HTMLButtonElement>('.diagrade-zoom-dialog__close')!;
    act(() => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('FR-08: 백드롭 클릭은 닫지 않음', () => {
    const onClose = vi.fn();
    mount({ args: makeArgs(), onClose });
    const backdrop = container.querySelector<HTMLDivElement>('.diagrade-zoom-dialog__backdrop')!;
    act(() => {
      backdrop.click();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('FR-11/12: 100% 에서 ➕ → 150% 표시', () => {
    // 작은 viewBox → fit = 100% (확대 클램프)
    mount({ args: makeArgs({ svgNode: makeSvg('0 0 100 50') }), onClose: vi.fn() });
    const level = (): string =>
      container.querySelector<HTMLSpanElement>('.diagrade-zoom-dialog__level')!.textContent ?? '';
    expect(level()).toBe('100%');
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '.diagrade-zoom-dialog__btn[aria-label="확대"]'
    );
    act(() => {
      buttons[0].click();
    });
    expect(level()).toBe('150%');
  });

  it('FR-12: 양 끝에서 ➕ ➖ disabled', () => {
    mount({ args: makeArgs({ svgNode: makeSvg('0 0 100 50') }), onClose: vi.fn() });
    const zoomIn = container.querySelector<HTMLButtonElement>(
      '.diagrade-zoom-dialog__btn[aria-label="확대"]'
    )!;
    const zoomOut = container.querySelector<HTMLButtonElement>(
      '.diagrade-zoom-dialog__btn[aria-label="축소"]'
    )!;
    // fit = 1 (100%) — 위로 한 칸, 아래로 75% 으로 갈 수 있음.
    expect(zoomIn.disabled).toBe(false);
    expect(zoomOut.disabled).toBe(false);

    // 400% 까지 클릭 — 각 클릭을 별도 act 으로 commit, 다음 클릭이 새 closure 사용
    for (let i = 0; i < 5; i++) {
      act(() => {
        zoomIn.click();
      });
    }
    expect(zoomIn.disabled).toBe(true);

    // 다시 25% 까지 (zoomOut 활성)
    for (let i = 0; i < 10; i++) {
      act(() => {
        zoomOut.click();
      });
    }
    expect(zoomOut.disabled).toBe(true);
  });

  it('FR-21: ⬇ PNG → saveFile + writeBinary, suggestedFilename 생성', async () => {
    const deps = makeExportDeps();
    mount({ args: makeArgs(), onClose: vi.fn(), exportDeps: deps });
    const png = container.querySelector<HTMLButtonElement>(
      '.diagrade-zoom-dialog__btn[aria-label="PNG 로 내보내기"]'
    )!;
    await act(async () => {
      png.click();
      await vi.waitFor(() => expect(deps.saveFileMock).toHaveBeenCalled());
    });
    expect(deps.saveFileMock).toHaveBeenCalledWith('notes-1.png', [
      { name: 'PNG', extensions: ['png'] }
    ]);
    expect(deps.svgToPngMock).toHaveBeenCalledWith(expect.anything(), 2);
    expect(deps.writeBinaryMock).toHaveBeenCalledWith('/out/notes-1.png', 'QUJD');
  });

  it('FR-21: ⬇ SVG → saveFile + writeText (serialize 결과)', async () => {
    const deps = makeExportDeps();
    deps.saveFileMock.mockResolvedValueOnce('/out/notes-1.svg');
    mount({ args: makeArgs(), onClose: vi.fn(), exportDeps: deps });
    const svg = container.querySelector<HTMLButtonElement>(
      '.diagrade-zoom-dialog__btn[aria-label="SVG 로 내보내기"]'
    )!;
    await act(async () => {
      svg.click();
      await vi.waitFor(() => expect(deps.saveFileMock).toHaveBeenCalled());
    });
    expect(deps.saveFileMock).toHaveBeenCalledWith('notes-1.svg', [
      { name: 'SVG', extensions: ['svg'] }
    ]);
    expect(deps.serializeMock).toHaveBeenCalled();
    expect(deps.writeTextMock).toHaveBeenCalledWith('/out/notes-1.svg', '<svg/>');
  });

  it('saveFile 취소 (null) → write 호출 안 됨', async () => {
    const deps = makeExportDeps();
    deps.saveFileMock.mockResolvedValueOnce(null);
    mount({ args: makeArgs(), onClose: vi.fn(), exportDeps: deps });
    const png = container.querySelector<HTMLButtonElement>(
      '.diagrade-zoom-dialog__btn[aria-label="PNG 로 내보내기"]'
    )!;
    await act(async () => {
      png.click();
      await vi.waitFor(() => expect(deps.saveFileMock).toHaveBeenCalled());
    });
    expect(deps.writeBinaryMock).not.toHaveBeenCalled();
    expect(deps.svgToPngMock).not.toHaveBeenCalled();
  });

  it('export 실패 → onError 호출', async () => {
    const deps = makeExportDeps();
    deps.saveFileMock.mockRejectedValueOnce(new Error('boom'));
    const onError = vi.fn();
    mount({ args: makeArgs(), onClose: vi.fn(), onError, exportDeps: deps });
    const png = container.querySelector<HTMLButtonElement>(
      '.diagrade-zoom-dialog__btn[aria-label="PNG 로 내보내기"]'
    )!;
    await act(async () => {
      png.click();
      await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    });
    // PRD-016: 카피가 사용자 친화 톤으로 변경됨 — '내보내기에 실패했습니다…'.
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('내보내기에 실패'));
  });

  it('FR-22: ZoomStage 가 svgNode 사본 mount — 원본 부모 유지', () => {
    const original = makeSvg('0 0 100 50');
    const externalParent = document.createElement('div');
    externalParent.appendChild(original);
    mount({ args: makeArgs({ svgNode: original }), onClose: vi.fn() });
    expect(original.parentElement).toBe(externalParent);
    const stage = container.querySelector('.diagrade-zoom-stage__svg-host');
    expect(stage?.querySelector('svg')).not.toBeNull();
  });
});
