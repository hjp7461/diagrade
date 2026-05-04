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
  adjustOffsetForZoom,
  type Offset,
  type Size
} from './zoomState';
import { ZoomStage } from './ZoomStage';
import { serializeSvg } from '../../export/serializeSvg';
import { svgToPngDataUrl } from '../../export/svgToPngDataUrl';
import { suggestedDiagramFileName } from '../../export/suggestedFilename';
import type { PngScale } from '../../../shared/types';

/**
 * 다이어그램 확대보기 다이얼로그. PRD-011.
 *
 * args !== null 일 때만 표시 (싱글톤). 다른 다이어그램으로 교체 시 부모가 args 객체를
 * 새로 만들어 전달 — 본 컴포넌트는 args 변경을 인덱스로 사용해 상태를 재초기화한다.
 *
 * 닫기: ESC (FR-07) / ✕ 버튼 (FR-06). 백드롭 클릭 / 토글은 미지원 (FR-08).
 */

export interface ZoomDialogArgs {
  /** 본문에서 발췌한 원본 SVG. ZoomStage 가 cloneNode 사본을 사용 (FR-22). */
  svgNode: SVGElement;
  /** 본문에서의 정상 렌더 인덱스 (1 부터). 파일명 생성에 사용. */
  index: number;
  /** 활성 탭의 .md 파일 절대 경로. 없으면 null → 'diagram' fallback. */
  activeTabPath: string | null;
  /** PRD-006 의 pngScale. ⬇ PNG 결과의 픽셀 스케일. */
  pngScale: PngScale;
}

export interface DiagramZoomDialogProps {
  args: ZoomDialogArgs | null;
  onClose: () => void;
  /** 내보내기 실패 시 호출. 보통 NotificationStack 으로 연결. */
  onError?: (msg: string) => void;
  /** 테스트 seam — production 은 dependency 미지정 시 window.diagrade.* 사용. */
  exportDeps?: ExportDeps;
}

export interface ExportDeps {
  saveFile: (defaultName: string, filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
  writeText: (path: string, content: string) => Promise<void>;
  writeBinary: (path: string, base64: string) => Promise<void>;
  serialize?: typeof serializeSvg;
  svgToPng?: typeof svgToPngDataUrl;
}

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
  const [level, setLevel] = useState<ZoomLevel>(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  // FR-09: body overflow 잠금/복원.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // FR-07: ESC capture — 본문/검색바 keydown 보다 먼저 처리.
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

  // viewport 측정. dialog 는 fixed inset:0 이라 stage host 크기 = window 비례 → window resize 만 듣는다.
  useLayoutEffect(() => {
    const host = stageHostRef.current;
    if (!host) return;
    const measure = (): void => {
      const rect = host.getBoundingClientRect();
      // jsdom 같이 layout 이 0 인 환경에선 window 크기로 폴백 — 실 production 에서도 안전판.
      const w = rect.width > 0 ? rect.width : window.innerWidth;
      const h = rect.height > 0 ? rect.height : window.innerHeight;
      setViewportSize({ w, h });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // FR-13: args 변경 또는 viewport 첫 측정 시 fit-to-window + 중앙 offset.
  // viewport.w > 0 가 될 때까지 대기 (초기 0×0 이면 fit 의미 없음).
  const initedFor = useRef<{ args: ZoomDialogArgs | null }>({ args: null });
  useEffect(() => {
    if (initedFor.current.args === args) return;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return;
    initedFor.current.args = args;
    const fit = fitToWindow(viewBox, viewportSize);
    const content = { w: viewBox.w * fit, h: viewBox.h * fit };
    const center = recenterIfFits(viewportSize, content);
    setLevel(fit);
    setOffset(center ?? { x: 0, y: 0 });
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
  deps: ExportDeps | undefined,
  onError: ((msg: string) => void) | undefined
) {
  return useCallback(
    async (ext: 'svg' | 'png'): Promise<void> => {
      const saveFile = deps?.saveFile ?? window.diagrade.dialog.saveFile;
      const writeText = deps?.writeText ?? window.diagrade.fs.writeText;
      const writeBinary = deps?.writeBinary ?? window.diagrade.fs.writeBinary;
      const serialize = deps?.serialize ?? serializeSvg;
      const toPng = deps?.svgToPng ?? svgToPngDataUrl;

      try {
        const svg = args.svgNode as unknown as SVGSVGElement;
        const defaultName = suggestedDiagramFileName(args.activeTabPath, args.index, ext);
        const filter =
          ext === 'svg'
            ? { name: 'SVG', extensions: ['svg'] }
            : { name: 'PNG', extensions: ['png'] };
        const target = await saveFile(defaultName, [filter]);
        if (!target) return;
        if (ext === 'svg') {
          await writeText(target, serialize(svg));
        } else {
          const url = await toPng(svg, args.pngScale);
          await writeBinary(target, url.split(',')[1] ?? '');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        onError?.(`내보내기 실패: ${msg}`);
      }
    },
    [args, deps, onError]
  );
}
