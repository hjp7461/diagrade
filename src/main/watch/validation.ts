import { resolve, sep, extname, isAbsolute } from 'node:path';

/**
 * watch:set-active-path 의 path 검증. PRD-002 §5.2 SEC-01.
 *
 * renderer 가 임의 path 를 watch 시도해도 main 이 다음 조건을 모두 만족해야만 통과:
 *   ① 절대 경로
 *   ② .md / .markdown 확장자
 *   ③ 활성 탭 디렉터리 화이트리스트 (PRD-001 §5.2) 안에 위치
 *
 * 화이트리스트는 함수로 전달 — 호출 시점의 최신 상태를 사용 (탭 등록/해제 따라 변동).
 */

export interface WatchPathOptions {
  allowedDirs: () => string[];
}

const MD_EXTENSIONS = new Set(['.md', '.markdown']);

export function isValidWatchPath(path: string, opts: WatchPathOptions): boolean {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (!isAbsolute(path)) return false;
  if (!MD_EXTENSIONS.has(extname(path).toLowerCase())) return false;

  const dirs = opts.allowedDirs();
  if (dirs.length === 0) return false;

  const target = resolve(path);
  return dirs.some((dir) => {
    const dirAbs = resolve(dir);
    return target === dirAbs || target.startsWith(dirAbs + sep);
  });
}
