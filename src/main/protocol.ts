import { protocol, net } from 'electron';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * `diagrade-asset://` 커스텀 프로토콜. PRD §5.2 + SEC-06.
 *
 * 동작:
 *   1) 렌더러에서 `diagrade-asset://<tabId>/<relpath>` 형태로 img.src 가 들어옴.
 *   2) handler 가 tabId 로 등록된 디렉터리를 찾고, relpath 를 합성해 절대 경로화.
 *   3) 합성 결과가 등록된 디렉터리 하위인지 검증 (path traversal 방어).
 *   4) 통과하면 file:// 로 fetch.
 *
 * 잘못된 단순화 금지 (CLAUDE.md pitfall #1):
 *   - 화이트리스트 없이 file:// 직접 노출 → 임의 디스크 접근.
 *   - 경계 검증 없이 path.resolve 만 → `../../etc/passwd` 통과.
 */

export const IMAGE_PROTOCOL_PRIVILEGES: Electron.CustomScheme = {
  scheme: 'diagrade-asset',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true
  }
};

const tabDirs = new Map<string, string>();

export function registerTabDir(tabId: string, dir: string): void {
  tabDirs.set(tabId, resolve(dir));
}

export function unregisterTabDir(tabId: string): void {
  tabDirs.delete(tabId);
}

/**
 * `dirAbs/targetRel` 가 합성 후에도 dirAbs 의 하위인지 (`..` traversal 차단).
 * 순수 함수 — 단위 테스트로 보안 회귀 방지.
 */
export function isPathWithinDir(targetRel: string, dirAbs: string): boolean {
  const target = resolve(dirAbs, targetRel);
  const dir = resolve(dirAbs);
  return target === dir || target.startsWith(dir + sep);
}

export function registerImageProtocol(): void {
  protocol.handle('diagrade-asset', async (request) => {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('Bad URL', { status: 400 });
    }

    const tabId = decodeURIComponent(url.hostname);
    const relpath = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

    const dir = tabDirs.get(tabId);
    if (!dir) {
      return new Response('Tab not registered', { status: 404 });
    }

    if (!isPathWithinDir(relpath, dir)) {
      return new Response('Forbidden', { status: 403 });
    }

    const target = resolve(dir, relpath);
    return net.fetch(pathToFileURL(target).toString());
  });
}

/** 테스트용 — 등록 상태 검증. 프로덕션 코드에서는 사용하지 말 것. */
export const __test__ = {
  hasTabDir: (tabId: string) => tabDirs.has(tabId),
  reset: () => tabDirs.clear()
};
