import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

/**
 * markdown-it 인스턴스. 한 번 생성해 재사용.
 *
 * - `html: false`: 마크다운 안의 raw HTML 거부. DOMPurify 가 한 번 더 막지만 처음부터 차단.
 * - `linkify: true`: GFM autolink (FR-02).
 * - `breaks: false`: CommonMark 그대로 — 줄바꿈은 단락 안에서 그냥 공백.
 *
 * Mermaid 코드 블록은 ` ```mermaid ` 라는 일반 fenced code 로 들어와
 * `<pre><code class="language-mermaid">...</code></pre>` 로 emit 된다.
 * **커스텀 토큰 변환을 추가하지 않는다** (CLAUDE.md pitfall #2).
 * M4 에서 mermaid.run({ querySelector: '.language-mermaid' }) 가 그대로 처리.
 */
const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false
}).use(taskLists, { enabled: false, label: false, lineNumber: false });

export function parseMarkdown(source: string): string {
  return md.render(source);
}
