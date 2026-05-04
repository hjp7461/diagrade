import { useLayoutEffect, useRef } from 'react';
import { clampOffset, type Offset, type Size } from './zoomState';

/**
 * 줌/팬 스테이지. PRD-011 §3.4 (FR-16~20), §6.3 (cloneNode), NFR-02 (60fps).
 *
 * - SVG 사본을 마운트해 본문 노드와 분리 (FR-22).
 * - transform-origin 0 0 + `translate(offset) scale(level)` 단일 변경 — layout/paint 회피.
 * - 드래그 중에는 React state 우회: stageRef 의 inline transform 을 직접 변경, mouseup 에서만
 *   부모로 보고 (NFR-02). 부모가 줌 변경 등으로 offset prop 을 다시 내리면 useLayoutEffect 가
 *   transform 을 재적용해 일관성 복원.
 *
 * window-level mousemove/mouseup 을 사용해 마우스가 스테이지 밖으로 나가도 드래그가 끊기지 않는다.
 */

export interface ZoomStageProps {
  /** 본문에서 발췌한 원본 SVG. ZoomStage 가 cloneNode 사본을 마운트한다 (FR-22). */
  svgNode: SVGElement;
  level: number;
  offset: Offset;
  /** 스케일된 콘텐츠 크기 (viewBox.w × level, viewBox.h × level). 부모가 계산해 전달. */
  contentSize: Size;
  /** 스테이지 inner box 크기. 부모가 ResizeObserver 로 측정해 전달. */
  viewportSize: Size;
  onOffsetChange: (offset: Offset) => void;
}

interface DragSession {
  startX: number;
  startY: number;
  startOffset: Offset;
}

export function ZoomStage({
  svgNode,
  level,
  offset,
  contentSize,
  viewportSize,
  onOffsetChange
}: ZoomStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const draggingRef = useRef(false);

  // FR-22: SVG cloneNode 마운트. svgNode 가 바뀌면 (다이어그램 교체) 새로 mount.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const clone = svgNode.cloneNode(true) as SVGElement;
    // 본문 SVG 가 받은 max-width / display 제약은 transform 과 충돌. 명시 제거.
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.style.maxWidth = 'none';
    clone.style.maxHeight = 'none';
    clone.style.display = 'block';
    host.appendChild(clone);
    return () => {
      host.replaceChildren();
    };
  }, [svgNode]);

  // transform 적용. 드래그 중에는 직접 manipulate 가 우선 — 그때는 prop 변경 무시.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || draggingRef.current) return;
    stage.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${level})`;
  }, [level, offset]);

  const onMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return; // 좌클릭만
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    draggingRef.current = true;
    stage.style.cursor = 'grabbing';
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffset: offset
    };

    const onMove = (ev: MouseEvent): void => {
      const d = dragRef.current;
      if (!d) return;
      const x = d.startOffset.x + (ev.clientX - d.startX);
      const y = d.startOffset.y + (ev.clientY - d.startY);
      stage.style.transform = `translate(${x}px, ${y}px) scale(${level})`;
    };

    const onUp = (ev: MouseEvent): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const d = dragRef.current;
      dragRef.current = null;
      draggingRef.current = false;
      stage.style.cursor = 'grab';
      if (!d) return;
      const next = {
        x: d.startOffset.x + (ev.clientX - d.startX),
        y: d.startOffset.y + (ev.clientY - d.startY)
      };
      onOffsetChange(clampOffset(next, viewportSize, contentSize));
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="diagrade-zoom-stage" onMouseDown={onMouseDown}>
      <div
        ref={stageRef}
        className="diagrade-zoom-stage__inner"
        style={{
          transformOrigin: '0 0',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${level})`,
          cursor: 'grab'
        }}
      >
        <div ref={hostRef} className="diagrade-zoom-stage__svg-host" />
      </div>
    </div>
  );
}
