/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import mermaid from 'mermaid';
import { extractMermaidBlocks } from './helpers/extractMermaidBlocks';

/**
 * PRD-012 회귀: `_ANALYSIS/` snapshot 의 모든 mermaid 블록을 mermaid.parse 로 통과.
 *
 * 의도:
 *   - parse 가 통과하면 → 본문 렌더 실패 원인은 mermaid layout(jsdom 미지원) 또는
 *     production 의 다른 단계. 즉 우리 코드가 막을 수 있는 게 아님 → fallback UX 보강만.
 *   - parse 가 실패하면 → mermaid 가 거부한 입력 패턴이 무엇인지 메시지로 확정 →
 *     init.ts 옵션 조정 또는 사용자 markdown 수정 권고.
 *
 * mermaid.parse 는 layout API 의존 없음 — jsdom 에서 안전하게 호출 가능.
 *
 * fixture 디렉토리는 사내 자료라 .gitignore 됨 — 로컬에 없으면 graceful skip.
 * 본 테스트의 회귀 가치는 *snapshot 보유 환경* 에서 실행될 때 발생한다.
 */

const fixtureDir = join(__dirname, '../fixtures/regression/_ANALYSIS-snapshot');
const fixtureAvailable = existsSync(fixtureDir);

const files = fixtureAvailable
  ? readdirSync(fixtureDir).filter(
      (f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md'
    )
  : [];

beforeAll(() => {
  if (!fixtureAvailable) return;
  // production 과 동일한 설정. init.ts 와 가능한 한 같은 옵션.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    flowchart: { useMaxWidth: true, htmlLabels: true },
    sequence: { useMaxWidth: true }
  });
});

describe.skipIf(!fixtureAvailable)('PRD-012 회귀 fixture — mermaid.parse', () => {
  for (const file of files) {
    const md = readFileSync(join(fixtureDir, file), 'utf-8');
    const blocks = extractMermaidBlocks(md);

    it(`${file} — fence 가 1 개 이상 존재`, () => {
      expect(blocks.length).toBeGreaterThan(0);
    });

    blocks.forEach((src, idx) => {
      it(`${file} #${idx + 1} parses (PRD-012 FR-01)`, async () => {
        let parseError: unknown = null;
        try {
          // suppressErrors: true 면 실패 시 false 반환, throw X.
          const ok = await mermaid.parse(src, { suppressErrors: true });
          if (ok === false) {
            parseError = `mermaid.parse returned false for block #${idx + 1}\n` +
              `--- source (first 400 chars) ---\n${src.slice(0, 400)}`;
          }
        } catch (e) {
          parseError = e instanceof Error ? `${e.message}\n--- source ---\n${src.slice(0, 400)}` : String(e);
        }
        expect(parseError, parseError ? String(parseError) : undefined).toBeNull();
      });
    });
  }
});

describe('PRD-012 fixture 환경 sanity', () => {
  it('fixture snapshot 디렉토리 (가능한 경우) — fixture 가 있다면 README 외 .md 가 1 개 이상', () => {
    if (!fixtureAvailable) {
      // 디렉토리 없는 환경 (CI / 새 클론) — skip 의미.
      expect(files.length).toBe(0);
      return;
    }
    expect(files.length).toBeGreaterThan(0);
  });
});
