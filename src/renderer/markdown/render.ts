import { parseMarkdown } from './parse';
import { sanitizeMarkdownHtml } from './sanitize';
import { rewriteImageSrcs } from './imageRewriter';

/**
 * 마크다운 → 안전 HTML 동기 파이프라인.
 *
 * 순서:
 *   1) markdown-it 으로 raw HTML 생성 (FR-01/02)
 *   2) img[src] 를 diagrade-asset:// 로 치환 (FR-04, SEC-06)
 *   3) DOMPurify sanitize (FR-05)
 *
 * Shiki 하이라이트 (FR-03) 는 비동기라 별도 단계 — render 후 mount 된 DOM 에
 * applyHighlight 를 호출한다 (highlight.ts 참조).
 */
export function renderMarkdown(source: string, tabId: string): string {
  const raw = parseMarkdown(source);
  const rewritten = rewriteImageSrcs(raw, tabId);
  return sanitizeMarkdownHtml(rewritten);
}
