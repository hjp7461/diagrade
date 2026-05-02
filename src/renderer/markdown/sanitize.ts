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

/**
 * Mermaid SVG 출력에 DOMPurify 를 적용하지 않는 이유 (M4 의 trust decision):
 *
 *   - Mermaid 11 의 `securityLevel: 'strict'` 는 라벨의 사용자 입력 HTML 을 텍스트로
 *     escape 하므로, 출력 SVG 의 foreignObject 안에는 실행 가능한 HTML 이 들어가지 않는다.
 *   - DOMPurify 의 svg+html 프로필은 (a) viewBox 의 case 를 깎고 (b) foreignObject 안의
 *     <div> 같은 HTML 요소를 같은 namespace 검증 때문에 strip 한다 — 정상 mermaid 출력을
 *     깬다. 이를 우회하려면 hook 레벨의 복잡한 namespace-aware 설정이 필요한데,
 *     strict 모드의 안전성과 비교해 비용 대비 효익이 낮다.
 *   - 신뢰 가정: mermaid 라이브러리 (mature, 검증된 escape 처리) + strict 모드.
 *     변경 시 (예: securityLevel 완화) 이 가정을 재검토해야 한다.
 *
 * 마크다운 본문 sanitize (sanitizeMarkdownHtml) 는 SVG 를 *허용하지 않는다* — mermaid 는
 * sanitize 우회 경로(post-mount mermaid.run) 로만 SVG 를 만들어 mount 한다.
 * 따라서 마크다운 안의 임의 SVG/foreignObject 는 여전히 차단된다.
 */
