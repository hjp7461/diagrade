/**
 * Renderer-safe path helpers. Node 의 path 모듈을 쓸 수 없는 sandboxed renderer 용.
 * POSIX (/) + Windows (\) 양쪽 separator 를 모두 처리한다.
 */

export function basenameOfPath(p: string): string {
  let lastSep = -1;
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (c === '/' || c === '\\') {
      lastSep = i;
      break;
    }
  }
  return lastSep >= 0 ? p.slice(lastSep + 1) : p;
}

export function dirnameOfPath(p: string): string {
  let lastSep = -1;
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (c === '/' || c === '\\') {
      lastSep = i;
      break;
    }
  }
  return lastSep >= 0 ? p.slice(0, lastSep) : '';
}

const MD_EXTENSIONS = ['.md', '.markdown'] as const;

export function isMarkdownPath(path: string): boolean {
  const lower = path.toLowerCase();
  return MD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
