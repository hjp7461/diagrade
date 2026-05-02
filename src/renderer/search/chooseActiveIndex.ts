/**
 * 활성 매칭 결정. PRD-003 FR-16, §6.1.
 *
 * **페이지 단위 우선 정책** (Diagrade 는 에디터가 아닌 뷰어 — 라인 포커스 개념 없음):
 *
 *   1) viewport `[scrollTop, scrollTop + viewportHeight]` 안 매칭 중 최상단 (top-down 첫번째)
 *   2) viewport 안 매칭 0 개 → viewport 위쪽 가장 가까운 매칭 (방금 지나친 항목)
 *   3) 위에도 없으면 → 아래쪽 첫번째 매칭 (인덱스 0)
 *
 * 입력은 `matchTops` (각 매칭의 offsetTop 배열) — DOM 의존 없이 단위 테스트 가능.
 * 호출자는 `matches.map((m) => m.offsetTop)` 으로 전달.
 *
 * 가정: matches 는 document 순서로 정렬됨 (offsetTop 가 단조 증가, mostly).
 */
export function chooseActiveIndex(
  matchTops: number[],
  scrollTop: number,
  viewportHeight: number
): number {
  if (matchTops.length === 0) return -1;

  const viewportBottom = scrollTop + viewportHeight;

  // 1. viewport 안 매칭 — 최상단 우선
  for (let i = 0; i < matchTops.length; i++) {
    const top = matchTops[i]!;
    if (top >= scrollTop && top < viewportBottom) return i;
  }

  // 2. viewport 위쪽 — 가장 가까운 (즉, 가장 마지막으로 작은 값)
  let aboveIdx = -1;
  for (let i = 0; i < matchTops.length; i++) {
    if (matchTops[i]! < scrollTop) aboveIdx = i;
    else break;
  }
  if (aboveIdx >= 0) return aboveIdx;

  // 3. 위에도 없음 → 아래쪽 첫번째 (인덱스 0)
  return 0;
}
