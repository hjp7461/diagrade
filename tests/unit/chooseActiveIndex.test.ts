import { describe, it, expect } from 'vitest';
import { chooseActiveIndex } from '../../src/renderer/search/chooseActiveIndex';

describe('chooseActiveIndex (PRD-003 FR-16, 페이지 단위 정책)', () => {
  const VH = 800; // viewport height

  it('빈 매칭 → -1', () => {
    expect(chooseActiveIndex([], 0, VH)).toBe(-1);
  });

  it('viewport 안 매칭 1 개 → 그것이 활성', () => {
    // scrollTop=1000, viewport=[1000, 1800], 매칭 [1500] in viewport
    expect(chooseActiveIndex([1500], 1000, VH)).toBe(0);
  });

  it('viewport 안 매칭 여러 개 → 최상단 (top-down 첫번째)', () => {
    // viewport=[1000, 1800], 매칭 [1200, 1400, 1700] 모두 안에 있음
    expect(chooseActiveIndex([1200, 1400, 1700], 1000, VH)).toBe(0);
  });

  it('viewport 위쪽에 매칭, 안에는 X → 위쪽 가장 가까운 (마지막) 매칭', () => {
    // viewport=[1000, 1800], 매칭 [200, 500, 900] 모두 위쪽
    // 가장 가까운 = 900 → index 2
    expect(chooseActiveIndex([200, 500, 900], 1000, VH)).toBe(2);
  });

  it('viewport 위쪽 매칭 1 개 → 그것이 활성', () => {
    expect(chooseActiveIndex([300], 1000, VH)).toBe(0);
  });

  it('viewport 안 X, 위쪽 X, 아래쪽만 → 첫번째 매칭 (index 0)', () => {
    // scrollTop=0, viewport=[0, 800], 매칭 [2000, 3000] 모두 아래
    expect(chooseActiveIndex([2000, 3000], 0, VH)).toBe(0);
  });

  it('viewport 안 + 아래쪽 모두 — 안의 최상단 우선 (FR-16 1번 우선)', () => {
    // viewport=[1000, 1800], 매칭 [1500 (안), 2000 (아래)]
    expect(chooseActiveIndex([1500, 2000], 1000, VH)).toBe(0);
  });

  it('viewport 안 + 위쪽 모두 — 안의 최상단 우선', () => {
    // viewport=[1000, 1800], 매칭 [500 (위), 1500 (안)]
    expect(chooseActiveIndex([500, 1500], 1000, VH)).toBe(1);
  });

  it('viewport 경계: scrollTop 정확히 일치 → viewport 안으로 간주 (>=)', () => {
    expect(chooseActiveIndex([1000], 1000, VH)).toBe(0);
  });

  it('viewport 경계: viewportBottom 정확히 일치 → 밖으로 간주 (<)', () => {
    // viewport=[1000, 1800], 매칭 [1800] — strict less-than 이라 밖
    // 다른 매칭 없으니 위쪽 폴백 X → 아래쪽 첫번째 = index 0
    expect(chooseActiveIndex([1800], 1000, VH)).toBe(0);
  });

  it('scrollTop=0, 첫 매칭 0 — viewport 안 (>=)', () => {
    expect(chooseActiveIndex([0, 100], 0, VH)).toBe(0);
  });
});
