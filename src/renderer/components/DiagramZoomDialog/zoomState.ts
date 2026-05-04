/**
 * 줌 / pan 상태 헬퍼. PRD-011 §3.3, §3.4, §6.1, §6.6.
 *
 * 모든 함수는 순수 — DOM / window 의존 없음. ZoomStage 와 DiagramZoomDialog 의
 * 인터랙션 분기를 jsdom 단위 테스트로 잠그기 위함.
 *
 * 좌표계 가정:
 *   - 콘텐츠는 transform-origin 0 0 으로 `translate(offset) scale(level)` 적용.
 *   - content 인자(Size)는 *스케일된* 콘텐츠 크기 (viewBox × level). 호출자가 계산.
 *   - viewport 는 ZoomStage 의 inner box 크기.
 */

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
export type ZoomLevel = (typeof ZOOM_STEPS)[number];

export interface Offset {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

/** 한 모서리가 viewport 안에 최소 이만큼 px 남도록 클램프. PRD-011 FR-19. */
export const DEFAULT_PAN_MARGIN = 80;

/** 현재 level 보다 *엄격히 큰* 첫 ZOOM_STEP 으로 이동. PRD-015.
 *
 * 이전 (PRD-011 ~ PRD-012) 은 indexOf 가 -1 일 때 normalize(nearest) 로 fallback 했는데,
 * fit ratio 가 0.35 같은 임의 값일 때 nearest = 0.25 가 되어 ➕ 가 *축소* 로 동작하는
 * 회귀가 발생. 방향 strict 로 변경 — ZOOM_STEPS 의 정확 단계든 임의 ratio 든 동일 동작.
 * level 이 ZOOM_STEPS 의 최대 (4) 이상이면 4 그대로.
 */
export function zoomIn(level: number): ZoomLevel {
  for (const s of ZOOM_STEPS) {
    if (s > level) return s;
  }
  return ZOOM_STEPS[ZOOM_STEPS.length - 1];
}

/** 현재 level 보다 *엄격히 작은* 가장 큰 ZOOM_STEP 으로 이동. PRD-015.
 * level ≤ 0.25 (최소) 이면 0.25 그대로. */
export function zoomOut(level: number): ZoomLevel {
  let best: ZoomLevel | null = null;
  for (const s of ZOOM_STEPS) {
    if (s < level) best = s;
    else break;
  }
  return best ?? ZOOM_STEPS[0];
}

export function canZoomIn(level: number): boolean {
  return level < ZOOM_STEPS[ZOOM_STEPS.length - 1];
}

export function canZoomOut(level: number): boolean {
  return level > ZOOM_STEPS[0];
}

/**
 * viewBox 가 viewport 안에 들어가는 fit ratio. 100% 상한 (FR-13). 하한 없음 (PRD-012 FR-03).
 *
 * - 작은 다이어그램(ratio ≥ 1)은 100% 로 표시 — 픽셀 깨짐 없음.
 * - 큰 다이어그램은 ratio 자체를 그대로 반환해 한 번에 viewport 에 들어오게 한다.
 *   (이전 정책: ZOOM_STEPS 의 디스크리트 단계로 스냅 + 0.25 하한 클램프 →
 *    매우 큰 시퀀스에서 fit 후에도 콘텐츠가 viewport 보다 커서 좌상단만 보임 — PRD-012 Issue B.)
 *
 * 반환 타입은 number — +/- 버튼은 별도로 ZOOM_STEPS 기반으로 동작 (zoomIn/zoomOut).
 */
export function fitToWindow(viewBox: Size, viewport: Size): number {
  if (viewBox.w <= 0 || viewBox.h <= 0 || viewport.w <= 0 || viewport.h <= 0) {
    return 1;
  }
  const ratio = Math.min(viewport.w / viewBox.w, viewport.h / viewBox.h);
  return ratio >= 1 ? 1 : ratio;
}

/**
 * offset 이 너무 멀어서 다이어그램이 viewport 밖으로 거의 사라지는 걸 방지. FR-19.
 *
 * 콘텐츠는 [offset.x, offset.x + content.w] 의 화면 위치를 차지.
 *   - 우측 가장자리(offset.x + content.w) 가 viewport 좌끝에서 margin 이상 안쪽에 있어야:
 *     offset.x ≥ margin - content.w
 *   - 좌측 가장자리(offset.x) 가 viewport 우끝에서 margin 이상 안쪽에 있어야:
 *     offset.x ≤ viewport.w - margin
 */
export function clampOffset(
  offset: Offset,
  viewport: Size,
  content: Size,
  margin: number = DEFAULT_PAN_MARGIN
): Offset {
  const minX = margin - content.w;
  const maxX = viewport.w - margin;
  const minY = margin - content.h;
  const maxY = viewport.h - margin;
  return {
    x: clamp(offset.x, minX, maxX),
    y: clamp(offset.y, minY, maxY)
  };
}

/** 콘텐츠가 viewport 보다 작으면 중앙 정렬 offset 을 반환. 그렇지 않으면 null. FR-20.
 *
 * +/- 줌 경로(applyZoom) 에서 사용 — content > viewport 일 때는 사용자가 보고 있던 위치를
 * clampOffset 으로 유지해야 하므로 null 분기가 의미 있다. 첫 fit 정렬은 centerOffset 을 사용.
 */
export function recenterIfFits(viewport: Size, content: Size): Offset | null {
  if (content.w <= viewport.w && content.h <= viewport.h) {
    return centerOffset(viewport, content);
  }
  return null;
}

/**
 * 콘텐츠를 viewport 중앙에 두는 offset. content 가 viewport 보다 커도 음수 offset 으로 중앙. PRD-012 FR-03.
 *
 * 첫 fit 적용 (DiagramZoomDialog 의 args 변경 시) 에서만 사용 — 큰 시퀀스 다이어그램이
 * fit 후에도 viewport 보다 큰 케이스에서 좌상단만 보이고 끝나는 PRD-012 Issue B 의 수정.
 */
export function centerOffset(viewport: Size, content: Size): Offset {
  return {
    x: (viewport.w - content.w) / 2,
    y: (viewport.h - content.h) / 2
  };
}

/**
 * 줌 변경 시 viewport 중앙에 보이던 콘텐츠 좌표가 줌 후에도 화면 중앙에 남도록 offset 보정. FR-14.
 *
 * 유도:
 *   viewport 중앙(스크린)을 콘텐츠 좌표(스케일 X)로 변환:
 *     contentMid = (viewport/2 - oldOffset) / oldLevel
 *   새 level 에서 그 좌표를 다시 viewport 중앙으로 보내려면:
 *     newOffset = viewport/2 - contentMid * newLevel
 *               = viewport/2 - (viewport/2 - oldOffset) * (newLevel / oldLevel)
 */
export function adjustOffsetForZoom(
  oldOffset: Offset,
  oldLevel: number,
  newLevel: number,
  viewport: Size
): Offset {
  if (oldLevel <= 0) return oldOffset;
  const ratio = newLevel / oldLevel;
  return {
    x: viewport.w / 2 - (viewport.w / 2 - oldOffset.x) * ratio,
    y: viewport.h / 2 - (viewport.h / 2 - oldOffset.y) * ratio
  };
}

function clamp(v: number, lo: number, hi: number): number {
  if (lo > hi) return (lo + hi) / 2;
  return Math.max(lo, Math.min(hi, v));
}
