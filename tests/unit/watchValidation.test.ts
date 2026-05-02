import { describe, it, expect } from 'vitest';
import { isValidWatchPath } from '../../src/main/watch/validation';

const ALLOWED = ['/Users/x/docs', '/var/local/notes'];
const opts = { allowedDirs: () => ALLOWED };

describe('isValidWatchPath (PRD-002 SEC-01/02)', () => {
  it('정상: 절대경로 + .md + 화이트리스트 안', () => {
    expect(isValidWatchPath('/Users/x/docs/note.md', opts)).toBe(true);
    expect(isValidWatchPath('/var/local/notes/sub/log.markdown', opts)).toBe(true);
  });

  it('대소문자 무관 확장자', () => {
    expect(isValidWatchPath('/Users/x/docs/NOTE.MD', opts)).toBe(true);
  });

  it('상대 경로 거부', () => {
    expect(isValidWatchPath('notes/x.md', opts)).toBe(false);
    expect(isValidWatchPath('./x.md', opts)).toBe(false);
  });

  it('지원하지 않는 확장자 거부', () => {
    expect(isValidWatchPath('/Users/x/docs/note.txt', opts)).toBe(false);
    expect(isValidWatchPath('/Users/x/docs/note', opts)).toBe(false);
    expect(isValidWatchPath('/Users/x/docs/note.png', opts)).toBe(false);
  });

  it('화이트리스트 밖 거부', () => {
    expect(isValidWatchPath('/etc/passwd.md', opts)).toBe(false);
    expect(isValidWatchPath('/Users/y/secret.md', opts)).toBe(false);
  });

  it('화이트리스트가 비어있으면 모두 거부', () => {
    expect(isValidWatchPath('/Users/x/docs/note.md', { allowedDirs: () => [] })).toBe(false);
  });

  it('화이트리스트 디렉터리 prefix 만 일치하는 sibling 차단', () => {
    // /Users/x/docs 가 허용 → /Users/x/docs-sibling 은 차단되어야 함
    expect(
      isValidWatchPath('/Users/x/docs-sibling/note.md', opts)
    ).toBe(false);
  });

  it('빈 문자열 / null-like 거부', () => {
    expect(isValidWatchPath('', opts)).toBe(false);
    // @ts-expect-error -- 런타임 견고성 확인: 타입 시스템 우회한 null 입력
    expect(isValidWatchPath(null, opts)).toBe(false);
    // @ts-expect-error -- 런타임 견고성 확인: 타입 시스템 우회한 undefined 입력
    expect(isValidWatchPath(undefined, opts)).toBe(false);
  });

  it('path traversal 시도는 resolve 후 화이트리스트 검증으로 차단', () => {
    // /Users/x/docs/../../../etc/passwd.md → resolve 하면 /etc/passwd.md → 화이트리스트 외
    expect(
      isValidWatchPath('/Users/x/docs/../../../etc/passwd.md', opts)
    ).toBe(false);
  });

  it('화이트리스트 dir 자체 (파일이 아님) 도 일치 (드물지만 가능)', () => {
    // 정상 파일 케이스만 들어오지만 robustness 차원
    expect(isValidWatchPath('/Users/x/docs.md', { allowedDirs: () => ['/Users/x/docs.md'] })).toBe(
      true
    );
  });
});
