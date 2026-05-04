/**
 * 마크다운 본문에서 ```mermaid fence 의 본문만 모두 뽑는다. 순수 함수.
 *
 * markdown-it 의 파서에 의존하지 않고 정규식만 사용 — fixture parse 테스트가
 * 마크다운 파이프라인의 다른 변경에 영향받지 않도록 격리.
 */
export function extractMermaidBlocks(markdown: string): string[] {
  const re = /```mermaid\r?\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  for (const m of markdown.matchAll(re)) {
    blocks.push(m[1]);
  }
  return blocks;
}
