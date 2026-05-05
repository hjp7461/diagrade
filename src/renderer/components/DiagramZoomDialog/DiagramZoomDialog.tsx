import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type ZoomLevel,
  zoomIn,
  zoomOut,
  canZoomIn,
  canZoomOut,
  fitToWindow,
  clampOffset,
  recenterIfFits,
  centerOffset,
  adjustOffsetForZoom,
  type Offset,
  type Size
} from './zoomState';
import { ZoomStage } from './ZoomStage';
import {
  exportSingleChart,
  type ExportSingleDeps
} from '../../export/exportSingleChart';
import type { PngScale } from '../../../shared/types';

/**
 * 다이어그램 확대보기 다이얼로그. PRD-011.
 *
 * args !== null 일 때만 마운트 (싱글톤). 다른 다이어그램으로 교체하려면 부모가 args 객체를
 * 새로 만들어 내려야 한다 — 컴포넌트는 args 동일성으로 fit 재계산 분기.
 */

export interface ZoomDialogArgs {
  /** 본문 원본 SVG — ZoomStage 가 cloneNode 사본을 마운트하므로 호출자는 본문 노드 그대로 전달. */
  svgNode: SVGElement;
  /** 본문에서의 정상 렌더 인덱스 (1 부터). 파일명 생성에 사용. */
  index: number;
  /** 활성 탭의 .md 파일 절대 경로. 없으면 null → 'diagram' fallback. */
  activeTabPath: string | null;
  pngScale: PngScale;
}

export interface DiagramZoomDialogProps {
  args: ZoomDialogArgs | null;
  onClose: () => void;
  /** 내보내기 실패 시 호출. 보통 NotificationStack 으로 연결. */
  onError?: (msg: string) => void;
  /** 테스트 seam — production 은 미지정 시 window.diagrade.* + 기본 헬퍼 사용. */
  exportDeps?: ExportSingleDeps;
}

export type ExportDeps = ExportSingleDeps;

function readViewBox(svg: SVGElement): Size {
  const vb = (svg as SVGSVGElement).viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) return { w: vb.width, h: vb.height };
  const rect = svg.getBoundingClientRect();
  return { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
}

export function DiagramZoomDialog(props: DiagramZoomDialogProps) {
  if (!props.args) return null;
  return <DialogInner {...props} args={props.args} />;
}

function DialogInner({
  args,
  onClose,
  onError,
  exportDeps
}: DiagramZoomDialogProps & { args: ZoomDialogArgs }) {
  const stageHostRef = useRef<HTMLDivElement>(null);
  const viewBox = useMemo(() => readViewBox(args.svgNode), [args.svgNode]);

  const [viewportSize, setViewportSize] = useState<Size>({ w: 0, h: 0 });
  // PRD-012: fitToWindow 가 임의 ratio 를 반환할 수 있어 number 로 일반화. +/- 버튼은 여전히
  // ZoomLevel(=ZOOM_STEPS) 단위로 jump 하지만, fit 직후엔 임의 값일 수 있다.
  const [level, setLevel] = useState<number>(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // capture 단계로 등록 — 검색바/본문 keydown 보다 먼저 ESC 를 잡아야 다른 핸들러에 먹히지 않음.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);

  // dialog 가 fixed inset:0 이라 stage host 크기 = window 비례. ResizeObserver 대신 resize 만 듣는다.
  useLayoutEffect(() => {
    const host = stageHostRef.current;
    if (!host) return;
    const measure = (): void => {
      const rect = host.getBoundingClientRect();
      // jsdom 등 layout 이 0 인 환경 폴백 — production 에서도 안전판.
      const w = rect.width > 0 ? rect.width : window.innerWidth;
      const h = rect.height > 0 ? rect.height : window.innerHeight;
      setViewportSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // args 한 번에 한 번만 fit 적용 — 사용자 줌 변경을 resize 가 덮지 않도록 args 동일성으로 가드.
  // PRD-012 Issue B: fitToWindow 는 ratio 자체를 반환 (하한 X), centerOffset 은 콘텐츠가
  // viewport 보다 커도 음의 offset 으로 중앙 정렬 → 첫 페인트에 다이어그램의 가운데가 보임.
  const initedFor = useRef<{ args: ZoomDialogArgs | null }>({ args: null });
  useEffect(() => {
    if (initedFor.current.args === args) return;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return;
    initedFor.current.args = args;
    const fit = fitToWindow(viewBox, viewportSize);
    const content = { w: viewBox.w * fit, h: viewBox.h * fit };
    setLevel(fit);
    setOffset(centerOffset(viewportSize, content));
  }, [args, viewportSize, viewBox]);

  const contentSize: Size = { w: viewBox.w * level, h: viewBox.h * level };

  const applyZoom = useCallback(
    (next: ZoomLevel) => {
      if (next === level) return;
      const newContent = { w: viewBox.w * next, h: viewBox.h * next };
      const adjusted = adjustOffsetForZoom(offset, level, next, viewportSize);
      const recentered = recenterIfFits(viewportSize, newContent);
      setLevel(next);
      setOffset(recentered ?? clampOffset(adjusted, viewportSize, newContent));
    },
    [level, offset, viewBox, viewportSize]
  );

  const onClickZoomIn = useCallback(() => {
    if (canZoomIn(level)) applyZoom(zoomIn(level));
  }, [level, applyZoom]);

  const onClickZoomOut = useCallback(() => {
    if (canZoomOut(level)) applyZoom(zoomOut(level));
  }, [level, applyZoom]);

  const exportImpl = useExportImpl(args, exportDeps, onError);

  return (
    <div
      className="diagrade-zoom-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="다이어그램 확대보기"
    >
      <div className="diagrade-zoom-dialog__backdrop" />
      <div className="diagrade-zoom-dialog__chrome">
        <div className="diagrade-zoom-dialog__toolbar">
          <div className="diagrade-zoom-dialog__group">
            <button
              type="button"
              className="diagrade-zoom-dialog__btn"
              onClick={onClickZoomOut}
              disabled={!canZoomOut(level)}
              aria-label="축소"
              title="축소"
            >
              ➖
            </button>
            <span className="diagrade-zoom-dialog__level" aria-live="polite">
              {Math.round(level * 100)}%
            </span>
            <button
              type="button"
              className="diagrade-zoom-dialog__btn"
              onClick={onClickZoomIn}
              disabled={!canZoomIn(level)}
              aria-label="확대"
              title="확대"
            >
              ➕
            </button>
          </div>
          <div className="diagrade-zoom-dialog__group">
            <button
              type="button"
              className="diagrade-zoom-dialog__btn"
              onClick={() => void exportImpl('png')}
              aria-label="PNG 로 내보내기"
            >
              ⬇ PNG
            </button>
            <button
              type="button"
              className="diagrade-zoom-dialog__btn"
              onClick={() => void exportImpl('svg')}
              aria-label="SVG 로 내보내기"
            >
              ⬇ SVG
            </button>
            <button
              type="button"
              className="diagrade-zoom-dialog__close"
              onClick={onClose}
              aria-label="닫기"
              title="닫기 (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="diagrade-zoom-dialog__stage-host" ref={stageHostRef}>
          {viewportSize.w > 0 && (
            <ZoomStage
              svgNode={args.svgNode}
              level={level}
              offset={offset}
              contentSize={contentSize}
              viewportSize={viewportSize}
              onOffsetChange={setOffset}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function useExportImpl(
  args: ZoomDialogArgs,
  deps: ExportSingleDeps | undefined,
  onError: ((msg: string) => void) | undefined
) {
  return useCallback(
    async (ext: 'svg' | 'png'): Promise<void> => {
      const effective: ExportSingleDeps = deps ?? {
        saveFile: window.diagrade.dialog.saveFile,
        writeText: window.diagrade.fs.writeText,
        writeBinary: window.diagrade.fs.writeBinary
      };
      try {
        await exportSingleChart(
          args.svgNode as unknown as SVGSVGElement,
          args.index,
          args.activeTabPath,
          ext,
          args.pngScale,
          effective
        );
      } catch (e) {
        // PRD-016: console 에 stack 보존, 사용자에겐 menu.ts 와 동일한 친화 카피.
        console.error('zoom dialog export failed:', e);
        onError?.(
          '내보내기에 실패했습니다. 다이어그램이 너무 크거나 일시적인 문제일 수 있습니다.'
        );
      }
    },
    [args, deps, onError]
  );
}
