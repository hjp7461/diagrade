import { escapeRegExp } from './escapeRegExp';

/**
 * PRD-009: 비활성 탭의 raw markdown 텍스트에서 query 매칭 카운트만 계산.
 *
 * 활성 탭은 PRD-003 의 DOM 검색이 책임. 이 헬퍼는 비활성 탭만 다룬다.
 *
 * 설계:
 *   - DOM 매핑 X — 카운트만 (PRD-009 §6.2 / §6.3).
 *   - cache (fetcher 호출 0 의 hot path) 는 호출자 책임. 이 헬퍼는 매번 fetcher 호출.
 *   - regex 컴파일 실패 → 0 매칭 (PRD-007 SEC-01 와 동등).
 *   - fetcher 실패 (파일 삭제 등) → 해당 항목 결과에서 제외, 다른 탭은 영향 X.
 */

export interface OtherTabSearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

export interface OtherTabResult {
  tabId: string;
  fileName: string;
  count: number;
}

export interface OtherTabInput {
  id: string;
  filePath: string;
  fileName: string;
}

export type Fetcher = (path: string) => Promise<string>;

function buildRegExp(query: string, opts: OtherTabSearchOptions): RegExp | null {
  let pattern: string;
  if (opts.regex) {
    pattern = query;
  } else {
    pattern = escapeRegExp(query);
    if (pattern.length === 0) return null;
  }
  if (opts.wholeWord) pattern = '\\b' + pattern + '\\b';
  const flags = 'g' + (opts.caseSensitive ? '' : 'i');
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/**
 * 텍스트 내 매칭 카운트. matchAll 의 spec 이 zero-width 매칭 advance 를
 * 자체 보장하므로 lastIndex 수동 가드 불필요.
 */
export function countMatches(text: string, re: RegExp): number {
  let count = 0;
  for (const m of text.matchAll(re)) {
    if (m[0].length > 0) count++;
  }
  return count;
}

/**
 * 비활성 탭 목록을 받아 각 탭의 매칭 카운트 결과 배열 반환.
 *
 * - 매칭 0 인 탭은 결과에서 제외 (PRD-009 FR-13 의 패널 단순화 일관).
 * - 입력 순서를 유지 (sort X).
 * - fetcher 가 throw 한 탭은 결과에서 제외 (FR-09 — 앱 크래시 X).
 * - query 가 빈 문자열이면 빈 배열.
 */
export async function searchOtherTabs(
  inactiveTabs: OtherTabInput[],
  query: string,
  options: OtherTabSearchOptions,
  fetcher: Fetcher
): Promise<OtherTabResult[]> {
  if (query.length === 0 || inactiveTabs.length === 0) return [];

  const re = buildRegExp(query, options);
  if (!re) return [];

  const settled = await Promise.allSettled(
    inactiveTabs.map(async (tab) => {
      const text = await fetcher(tab.filePath);
      // matchAll 은 한 번 소비하면 끝 — 탭마다 새 RegExp 인스턴스.
      const localRe = new RegExp(re.source, re.flags);
      return { tab, count: countMatches(text, localRe) };
    })
  );

  const results: OtherTabResult[] = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue; // FR-09: fetch 실패 무시
    if (r.value.count === 0) continue; // FR-13: 0 카운트 제외
    results.push({
      tabId: r.value.tab.id,
      fileName: r.value.tab.fileName,
      count: r.value.count
    });
  }
  return results;
}
