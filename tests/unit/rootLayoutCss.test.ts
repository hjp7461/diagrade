/**
 * PRD-014 회귀 잠금 — theme.css 의 root layout reset 이 회귀 안전한 값임을 검증.
 *
 * 누가 `html, body { overflow: hidden }` 또는 `#root { height: 100% }` 를 제거하면
 * page-level scroll 이 다시 가능해져 검색 navigate 시 탭바가 사라지는 회귀가 재발한다.
 * 본 테스트가 그 시점에 fail.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = join(__dirname, '../../src/renderer/theme/theme.css');
const css = readFileSync(cssPath, 'utf-8');

function findBlock(selector: string): string | null {
  // selector { ... } 의 본문 추출. 셀렉터가 콤마 리스트 (`html, body`) 도 정확히 매치.
  const re = new RegExp(`(?:^|\\n)\\s*${escapeRegex(selector)}\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  return m ? m[1] : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('PRD-014: theme.css 의 root layout reset', () => {
  it('html, body 블록이 overflow: hidden 명시 (page-level scroll 차단)', () => {
    const block = findBlock('html, body');
    expect(block, 'theme.css 에 `html, body` 블록이 정확히 존재해야 함').not.toBeNull();
    expect(block).toMatch(/overflow\s*:\s*hidden/);
  });

  it('html, body 블록이 height: 100% 명시 (root div 100vh 와 정합)', () => {
    const block = findBlock('html, body');
    expect(block).not.toBeNull();
    expect(block).toMatch(/height\s*:\s*100%/);
  });

  it('#root 블록이 height: 100% 명시', () => {
    const block = findBlock('#root');
    expect(block, 'theme.css 에 `#root` 블록이 존재해야 함').not.toBeNull();
    expect(block).toMatch(/height\s*:\s*100%/);
  });
});
