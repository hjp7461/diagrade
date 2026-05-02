/**
 * PNG canvas 크기 계산 — CLAUDE.md pitfall #4, §6.3.
 *
 * 정책:
 *   - viewBox 의 width/height 가 양수면 그것을 base size 로 사용.
 *   - 없으면 getBoundingClientRect 의 width/height 로 폴백.
 *   - 두 값 모두 0/음수일 가능성에 대비 — 최소 1.
 *
 * **`getBoundingClientRect` 단독 사용 금지.** body `max-width` 같은 표시 제약 때문에
 * boundingClientRect 가 SVG natural size 보다 작아져 PNG 우/하단 잘림 (v1 PRD-006).
 *
 * 순수 함수로 분리한 이유: jsdom 의 canvas/SVG layout 한계 없이 회귀를 잠글 수 있다.
 */

export interface PngDimensions {
  /** SVG natural size (px). canvas 의 base 가 됨. */
  baseWidth: number;
  baseHeight: number;
  /** 최종 canvas size = base × scale (FR-23: 정확히 2 배). */
  canvasWidth: number;
  canvasHeight: number;
}

export function computePngDimensions(
  viewBoxWidth: number,
  viewBoxHeight: number,
  fallbackWidth: number,
  fallbackHeight: number,
  scale: number
): PngDimensions {
  const useViewBox = viewBoxWidth > 0 && viewBoxHeight > 0;
  const baseWidth = Math.max(
    1,
    Math.round(useViewBox ? viewBoxWidth : Math.max(0, fallbackWidth))
  );
  const baseHeight = Math.max(
    1,
    Math.round(useViewBox ? viewBoxHeight : Math.max(0, fallbackHeight))
  );
  return {
    baseWidth,
    baseHeight,
    canvasWidth: baseWidth * scale,
    canvasHeight: baseHeight * scale
  };
}
