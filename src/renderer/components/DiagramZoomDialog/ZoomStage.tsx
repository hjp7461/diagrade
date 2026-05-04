import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { clampOffset, type Offset, type Size } from './zoomState';

/**
 * 줌/팬 스테이지. PRD-011 §3.4, §6.3, NFR-02.
 *
 * 드래그 중에는 React state 를 우회하고 stageRef 의 inline transform 만 직접 갱신해
 * 60fps 를 유지한다. mousemove 는 rAF 1 프레임당 한 번만 적용 — 1000Hz 마우스에서
 * style write 폭주 방지.
 *
 * SVG 사본을 마운트해 본문 노드와 분리하는 이유: 본문 노드를 이동/제거하면
 * ⬇ 일괄 export 와 검색 인덱스가 깨진다.
 */

export interface ZoomStageProps {
  svgNode: SVGElement;
  level: number;
  offset: Offset;
  /** 스케일된 콘텐츠 크기 (viewBox.w × level, viewBox.h × level). */
  contentSize: Size;
  viewportSize: Size;
  onOffsetChange: (offset: Offset) => void;
}

interface DragSession {
  startX: number;
  startY: number;
  startOffset: Offset;
  /** 마지막 mousemove 의 좌표. rAF 가 읽음. */
  lastX: number;
  lastY: number;
  rafId: number | null;
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
  // 드래그 중에 부모가 새 offset/level prop 을 내려도 transform 덮어쓰지 않도록 표시.
  const propsRef = useRef({ level, offset });
  propsRef.current = { level, offset };

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const clone = svgNode.cloneNode(true) as SVGElement;
    // 본문에서 받은 max-width/display 제약은 transform 과 충돌 — 자연 크기 회복.
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

  // 드래그 중이 아닐 때만 prop 기반 transform 을 적용 — 드래그가 inline 으로 직접 쓴 값을 덮지 않음.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || dragRef.current) return;
    stage.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${level})`;
  }, [level, offset]);

  // 드래그가 unmount 시점에 살아있으면 window listener / rAF 가 누수된다 — cleanup 필수.
  useEffect(() => {
    return () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.rafId !== null) cancelAnimationFrame(d.rafId);
      window.removeEventListener('mousemove', onMoveRef.current!);
      window.removeEventListener('mouseup', onUpRef.current!);
      dragRef.current = null;
    };
  }, []);

  const onMoveRef = useRef<((ev: MouseEvent) => void) | null>(null);
  const onUpRef = useRef<((ev: MouseEvent) => void) | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent): void => {
      if (e.button !== 0) return;
      e.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const session: DragSession = {
        startX: e.clientX,
        startY: e.clientY,
        startOffset: propsRef.current.offset,
        lastX: e.clientX,
        lastY: e.clientY,
        rafId: null
      };
      dragRef.current = session;
      stage.style.cursor = 'grabbing';

      const flush = (): void => {
        session.rafId = null;
        const { lastX, lastY, startX, startY, startOffset } = session;
        const x = startOffset.x + (lastX - startX);
        const y = startOffset.y + (lastY - startY);
        stage.style.transform = `translate(${x}px, ${y}px) scale(${propsRef.current.level})`;
      };

      const onMove = (ev: MouseEvent): void => {
        session.lastX = ev.clientX;
        session.lastY = ev.clientY;
        if (session.rafId === null) {
          session.rafId = requestAnimationFrame(flush);
        }
      };

      const onUp = (ev: MouseEvent): void => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (session.rafId !== null) cancelAnimationFrame(session.rafId);
        dragRef.current = null;
        stage.style.cursor = 'grab';
        const next = {
          x: session.startOffset.x + (ev.clientX - session.startX),
          y: session.startOffset.y + (ev.clientY - session.startY)
        };
        onOffsetChange(clampOffset(next, viewportSize, contentSize));
      };

      onMoveRef.current = onMove;
      onUpRef.current = onUp;
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [contentSize, viewportSize, onOffsetChange]
  );

  return (
    <div className="diagrade-zoom-stage" onMouseDown={onMouseDown}>
      <div
        ref={stageRef}
        className="diagrade-zoom-stage__inner"
        style={{ transformOrigin: '0 0', cursor: 'grab' }}
      >
        <div ref={hostRef} className="diagrade-zoom-stage__svg-host" />
      </div>
    </div>
  );
}
