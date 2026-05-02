import { describe, it, expect } from 'vitest';
import { isPathWithinDir } from '../../src/main/protocol';
import { resolve } from 'node:path';

/**
 * SEC-06 / §5.2: diagrade-asset:// 프로토콜의 path traversal 방어.
 *
 * 회귀 시 시나리오: 누가 "단순화" 한답시고 path.resolve 만 하고 경계 검증을 빼면
 * `../../../etc/passwd` 가 통과한다. 이 테스트는 그걸 막는다.
 */
describe('isPathWithinDir (path traversal defense)', () => {
  const dir = resolve('/tmp/diagrade-fixture-dir');

  it('단순 파일명은 통과', () => {
    expect(isPathWithinDir('img.png', dir)).toBe(true);
  });

  it('서브디렉터리 파일은 통과', () => {
    expect(isPathWithinDir('assets/img.png', dir)).toBe(true);
    expect(isPathWithinDir('a/b/c/d.png', dir)).toBe(true);
  });

  it('빈 경로 (디렉터리 자체) 통과', () => {
    expect(isPathWithinDir('', dir)).toBe(true);
    expect(isPathWithinDir('.', dir)).toBe(true);
  });

  it('상위 디렉터리로 빠져나가는 시도 차단', () => {
    expect(isPathWithinDir('../etc/passwd', dir)).toBe(false);
    expect(isPathWithinDir('../../etc/passwd', dir)).toBe(false);
    expect(isPathWithinDir('a/../../etc/passwd', dir)).toBe(false);
  });

  it('합쳐서 같은 위치로 돌아오는 패턴은 통과', () => {
    expect(isPathWithinDir('a/../img.png', dir)).toBe(true);
  });

  it('절대 경로 주입 차단 (Linux/macOS)', () => {
    // path.resolve 는 절대 경로 인자를 만나면 그것으로 대체. 우리 검증은 그 결과가
    // dir 의 하위가 아니므로 거부한다.
    expect(isPathWithinDir('/etc/passwd', dir)).toBe(false);
    expect(isPathWithinDir('/usr/bin/whoami', dir)).toBe(false);
  });

  it('dir prefix 일치하지만 다른 디렉터리 차단 (e.g., /tmp/dirX 가 /tmp/dir 의 하위로 잘못 인식되면 안 됨)', () => {
    // dir = /tmp/diagrade-fixture-dir
    // sibling = /tmp/diagrade-fixture-dir-sibling — 문자열 startsWith 만으로는 통과해버림.
    // 우리 구현은 sep 까지 포함 비교라 차단되어야 한다.
    expect(isPathWithinDir('../diagrade-fixture-dir-sibling/x.png', dir)).toBe(false);
  });
});
