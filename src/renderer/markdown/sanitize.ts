import DOMPurify from 'dompurify';

/**
 * 마크다운 본문 sanitize. FR-05.
 *
 * 정책:
 *   - DOMPurify 의 default safe-HTML allowlist 를 사용 (script/iframe/onclick 등 자동 차단).
 *   - URI 만 ALLOWED_URI_REGEXP 로 확장: `diagrade-asset:` 추가 (SEC-06).
 *   - SVG / foreignObject 는 아직 미허용 — M4 에서 mermaid 도입 시 ADD_TAGS 추가.
 *
 * v3 의 inner filtering 우회 (hook):
 *   DOMPurify v3 는 ALLOWED_ATTR / ADD_ATTR 와 별개로 `<input type>`, `<a target/rel>`
 *   같은 일부 attr 를 hardcoded 로 깎는다. 이건 보안과 무관한 정상 마크다운 사용을 깨므로
 *   uponSanitizeAttribute 훅에서 forceKeepAttr 로 보존한다:
 *     - input[type=checkbox]: GFM task list 의 시각적 정합성
 *     - a[target], a[rel]: 외부 링크 target="_blank" 의도 보존 (실제 클릭은
 *       어차피 setWindowOpenHandler / will-navigate 가 가로챔)
 *
 * 변경 시 회귀 테스트 (tests/unit/markdown.test.ts) 갱신/실행 (CLAUDE.md pitfall #10).
 */

const ALLOWED_URI_REGEXP = /^(?:(?:https?|diagrade-asset|data|mailto):|[#/])/i;

DOMPurify.addHook('uponSanitizeAttribute', (node, hookEvent) => {
  if (
    node.nodeName === 'INPUT' &&
    hookEvent.attrName === 'type' &&
    hookEvent.attrValue === 'checkbox'
  ) {
    hookEvent.forceKeepAttr = true;
    return;
  }
  if (
    node.nodeName === 'A' &&
    (hookEvent.attrName === 'target' || hookEvent.attrName === 'rel')
  ) {
    hookEvent.forceKeepAttr = true;
  }
});

export function sanitizeMarkdownHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_URI_REGEXP,
    KEEP_CONTENT: true
  });
}

export const __testInternals = { ALLOWED_URI_REGEXP };
