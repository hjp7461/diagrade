import { describe, it, expect } from 'vitest';
import {
  ZOOM_STEPS,
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
  DEFAULT_PAN_MARGIN
} from '../../src/renderer/components/DiagramZoomDialog/zoomState';

describe('zoomIn / zoomOut (PRD-011 FR-12)', () => {
  it('100% → ➕ → 150%', () => {
    expect(zoomIn(1)).toBe(1.5);
  });

  it('100% → ➖ → 75%', () => {
    expect(zoomOut(1)).toBe(0.75);
  });

  it('400% 에서 ➕ → 400% 그대로', () => {
    expect(zoomIn(4)).toBe(4);
  });

  it('25% 에서 ➖ → 25% 그대로', () => {
    expect(zoomOut(0.25)).toBe(0.25);
  });

  it('canZoomIn / canZoomOut 양 끝 비활성', () => {
    expect(canZoomIn(4)).toBe(false);
    expect(canZoomIn(3)).toBe(true);
    expect(canZoomOut(0.25)).toBe(false);
    expect(canZoomOut(0.5)).toBe(true);
  });

  it('8 단계 모두 순회', () => {
    const expected = [...ZOOM_STEPS];
    let level: ZoomLevel = ZOOM_STEPS[0];
    const visited: number[] = [level];
    for (let i = 0; i < ZOOM_STEPS.length - 1; i++) {
      level = zoomIn(level);
      visited.push(level);
    }
    expect(visited).toEqual(expected);
  });
});

describe('zoomIn / zoomOut — 임의 fit ratio 진입 (PRD-015)', () => {
  it('zoomIn(0.35) === 0.5 (사용자 캡처 — 35% fit 후 ➕)', () => {
    // 이전(normalize): 0.25 (nearest, dist 0.10) → 의도와 반대로 *축소*.
    // 정정: 방향 strict next → 0.5.
    expect(zoomIn(0.35)).toBe(0.5);
  });

  it('zoomIn(0.99) === 1 (1 보다 살짝 작음 → 100% 로)', () => {
    expect(zoomIn(0.99)).toBe(1);
  });

  it('zoomIn(1.01) === 1.5 (1 보다 살짝 큼 → 150% 로, normalize 면 1 로 줄었음)', () => {
    expect(zoomIn(1.01)).toBe(1.5);
  });

  it('zoomIn(5) === 4 (모든 step 보다 큼 → 최대 step)', () => {
    expect(zoomIn(5)).toBe(4);
  });

  it('zoomOut(0.45) === 0.25 (대칭 회귀 — 0.5 가 nearest 지만 ➖ 는 작아져야 함)', () => {
    expect(zoomOut(0.45)).toBe(0.25);
  });

  it('zoomOut(0.99) === 0.75 (1 보다 살짝 작아도 한 단계 더 작은 step)', () => {
    expect(zoomOut(0.99)).toBe(0.75);
  });

  it('zoomOut(0.2) === 0.25 (모든 step 보다 작음 → 최소 step 그대로)', () => {
    expect(zoomOut(0.2)).toBe(0.25);
  });

  it('canZoomIn(5) === false (이미 최대 이상)', () => {
    expect(canZoomIn(5)).toBe(false);
    expect(canZoomIn(4)).toBe(false);
    expect(canZoomIn(3.99)).toBe(true);
  });

  it('canZoomOut(0.2) === false (이미 최소 이하)', () => {
    expect(canZoomOut(0.2)).toBe(false);
    expect(canZoomOut(0.25)).toBe(false);
    expect(canZoomOut(0.26)).toBe(true);
  });
});

describe('fitToWindow — 연속 fit (PRD-012 FR-03 / 기존 PRD-011 FR-13 갱신)', () => {
  it('viewBox 가 viewport 보다 약간 큼 → 정확한 ratio 반환 (이전: 0.25 스냅)', () => {
    // 2000×1500 / 800×600 → ratio 0.4
    expect(fitToWindow({ w: 2000, h: 1500 }, { w: 800, h: 600 })).toBeCloseTo(0.4, 5);
  });

  it('viewBox 가 매우 큼 (ratio < 0.25) → ratio 자체 반환 (하한 클램프 X)', () => {
    // 4000×2000 / 800×600 → ratio 0.2
    expect(fitToWindow({ w: 4000, h: 2000 }, { w: 800, h: 600 })).toBeCloseTo(0.2, 5);
  });

  it('정확히 ZOOM_STEPS 위의 ratio → 그 값 반환', () => {
    expect(fitToWindow({ w: 1600, h: 1200 }, { w: 800, h: 600 })).toBeCloseTo(0.5, 5);
  });

  it('작은 viewBox → 100% 상한 (확대 X)', () => {
    expect(fitToWindow({ w: 200, h: 150 }, { w: 800, h: 600 })).toBe(1);
  });

  it('viewBox 가 0 이거나 음수 → 100% fallback', () => {
    expect(fitToWindow({ w: 0, h: 100 }, { w: 800, h: 600 })).toBe(1);
    expect(fitToWindow({ w: -1, h: 100 }, { w: 800, h: 600 })).toBe(1);
  });

  it('viewport 가 0 → 100% fallback', () => {
    expect(fitToWindow({ w: 1000, h: 500 }, { w: 0, h: 0 })).toBe(1);
  });
});

describe('clampOffset (PRD-011 FR-19)', () => {
  const viewport = { w: 800, h: 600 };
  const content = { w: 2000, h: 1500 };

  it('큰 양수 offset → 우측 끝까지만', () => {
    const c = clampOffset({ x: 99999, y: 99999 }, viewport, content);
    // maxX = viewport.w - margin = 800 - 80 = 720
    expect(c.x).toBe(720);
    expect(c.y).toBe(600 - DEFAULT_PAN_MARGIN);
  });

  it('큰 음수 offset → 좌측 끝까지만', () => {
    const c = clampOffset({ x: -99999, y: -99999 }, viewport, content);
    // minX = margin - content.w = 80 - 2000 = -1920
    expect(c.x).toBe(80 - 2000);
    expect(c.y).toBe(80 - 1500);
  });

  it('범위 안 offset → 그대로', () => {
    const c = clampOffset({ x: 100, y: 50 }, viewport, content);
    expect(c).toEqual({ x: 100, y: 50 });
  });

  it('한 모서리 80px 이상 가시 — 우측 끝에서 콘텐츠가 viewport 밖으로 안 사라짐', () => {
    const c = clampOffset({ x: 99999, y: 0 }, viewport, content);
    // 좌측 가장자리(c.x) 가 viewport 우끝(800) 에서 80px 안쪽 = 720
    expect(c.x).toBeLessThanOrEqual(viewport.w - DEFAULT_PAN_MARGIN);
  });

  it('margin 인자 override', () => {
    const c = clampOffset({ x: 99999, y: 0 }, viewport, content, 0);
    expect(c.x).toBe(800);
  });
});

describe('recenterIfFits (PRD-011 FR-20 — +/- 줌 경로 전용)', () => {
  it('content ≤ viewport → 중앙 offset 반환', () => {
    const off = recenterIfFits({ w: 800, h: 600 }, { w: 200, h: 100 });
    expect(off).toEqual({ x: 300, y: 250 });
  });

  it('content > viewport → null (사용자가 보고 있던 위치 유지하도록 호출자가 clampOffset 사용)', () => {
    expect(recenterIfFits({ w: 800, h: 600 }, { w: 1000, h: 100 })).toBeNull();
    expect(recenterIfFits({ w: 800, h: 600 }, { w: 100, h: 1000 })).toBeNull();
  });
});

describe('centerOffset — 첫 fit 경로 전용 (PRD-012 FR-03)', () => {
  it('content ≤ viewport → 양수 offset 으로 중앙', () => {
    expect(centerOffset({ w: 800, h: 600 }, { w: 200, h: 100 })).toEqual({
      x: 300,
      y: 250
    });
  });

  it('content > viewport (양 축 모두) → 음의 offset 으로 중앙 (Issue B)', () => {
    expect(centerOffset({ w: 800, h: 600 }, { w: 1000, h: 800 })).toEqual({
      x: -100,
      y: -100
    });
  });

  it('한쪽 축만 큰 경우 — 큰 축은 음의 offset, 작은 축은 양수', () => {
    expect(centerOffset({ w: 800, h: 600 }, { w: 1200, h: 400 })).toEqual({
      x: -200,
      y: 100
    });
  });
});

describe('adjustOffsetForZoom (PRD-011 FR-14)', () => {
  const viewport = { w: 800, h: 600 };

  it('viewport 중앙에 보이던 좌표가 줌 후에도 viewport 중앙', () => {
    // oldLevel = 1, oldOffset = (0, 0): 콘텐츠 좌표 (400, 300) 가 viewport 중앙.
    // newLevel = 2 → 그 좌표를 다시 (400, 300) 로:
    //   newOffset = viewport/2 - (viewport/2 - 0) * 2 = -viewport/2
    const newOff = adjustOffsetForZoom({ x: 0, y: 0 }, 1, 2, viewport);
    expect(newOff).toEqual({ x: -400, y: -300 });
  });

  it('동일 줌 → offset 변화 없음', () => {
    expect(adjustOffsetForZoom({ x: 100, y: 50 }, 1, 1, viewport)).toEqual({ x: 100, y: 50 });
  });

  it('oldLevel = 0 보호 — offset 그대로 반환', () => {
    expect(adjustOffsetForZoom({ x: 100, y: 50 }, 0, 1, viewport)).toEqual({ x: 100, y: 50 });
  });
});
