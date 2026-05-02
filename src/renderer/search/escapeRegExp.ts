/**
 * 정규식 metachar 를 literal 로 escape. PRD-003 SEC-01.
 *
 * 사용자가 `*`, `?`, `(`, `)`, `[`, `]` 등을 검색하려고 입력했을 때 정규식 오용을 방지.
 * MDN 의 표준 패턴을 따름 (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions).
 */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
