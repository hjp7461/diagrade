/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../src/renderer/markdown/parse';
import { sanitizeMarkdownHtml } from '../../src/renderer/markdown/sanitize';
import { renderMarkdown } from '../../src/renderer/markdown/render';

describe('parseMarkdown (FR-01, FR-02 GFM)', () => {
  it('헤딩 → h1/h2/h3', () => {
    const out = parseMarkdown('# A\n\n## B\n\n### C');
    expect(out).toContain('<h1>A</h1>');
    expect(out).toContain('<h2>B</h2>');
    expect(out).toContain('<h3>C</h3>');
  });

  it('GFM 표 지원', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |\n';
    const out = parseMarkdown(md);
    expect(out).toContain('<table>');
    expect(out).toContain('<th>A</th>');
    expect(out).toContain('<td>1</td>');
  });

  it('GFM 취소선 지원', () => {
    expect(parseMarkdown('~~old~~')).toContain('<s>old</s>');
  });

  it('GFM fenced code block + 언어 클래스', () => {
    const out = parseMarkdown('```typescript\nconst x = 1;\n```\n');
    expect(out).toContain('<pre>');
    expect(out).toMatch(/<code class="language-typescript">/);
  });

  it('CLAUDE.md pitfall #2: mermaid 코드 블록은 평범한 fenced code 로 emit', () => {
    const out = parseMarkdown('```mermaid\nflowchart TD\nA-->B\n```\n');
    expect(out).toMatch(/<code class="language-mermaid">/);
    expect(out).toContain('flowchart TD');
  });

  it('GFM task list', () => {
    const out = parseMarkdown('- [ ] todo\n- [x] done\n');
    expect(out).toContain('type="checkbox"');
    expect(out).toMatch(/checked(="">|=""|>|\s)/);
  });

  it('linkify: bare URL 자동 링크', () => {
    const out = parseMarkdown('https://example.com 참조');
    expect(out).toContain('href="https://example.com"');
  });

  it('html: false — 마크다운 안의 raw HTML 은 escape', () => {
    const out = parseMarkdown('hello <script>alert(1)</script> world');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });
});

describe('sanitizeMarkdownHtml (FR-05, CLAUDE.md pitfall #10)', () => {
  it('script 태그 제거', () => {
    const dirty = '<p>before</p><script>alert(1)</script><p>after</p>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).toContain('<p>before</p>');
    expect(clean).toContain('<p>after</p>');
  });

  it('on* 이벤트 핸들러 속성 제거', () => {
    const dirty = '<a href="https://x" onclick="alert(1)">x</a>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).not.toContain('onclick');
    expect(clean).toContain('href="https://x"');
  });

  it('javascript: URL 거부', () => {
    const dirty = '<a href="javascript:alert(1)">x</a>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).not.toContain('javascript:');
  });

  it('iframe / object / embed 제거', () => {
    const dirty = '<iframe src="x"></iframe><object></object><embed></embed>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('<object');
    expect(clean).not.toContain('<embed');
  });

  it('diagrade-asset:// img src 는 보존 (FR-04 / SEC-06)', () => {
    const dirty = '<img src="diagrade-asset://tab1/img.png" alt="x">';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).toContain('diagrade-asset://tab1/img.png');
  });

  it('https/http img src 보존', () => {
    const dirty = '<img src="https://example.com/x.png">';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).toContain('https://example.com/x.png');
  });

  it('data: image src 보존', () => {
    const dirty = '<img src="data:image/png;base64,abc">';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).toContain('data:image/png;base64,abc');
  });

  it('GFM 표 보존', () => {
    const dirty = '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).toContain('<table>');
    expect(clean).toContain('<th>A</th>');
  });

  it('체크박스 input 보존 (task list)', () => {
    const dirty = '<input type="checkbox" disabled checked>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).toContain('type="checkbox"');
  });

  it('링크의 target/rel 보존', () => {
    const dirty = '<a href="https://x" target="_blank" rel="noopener">x</a>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener"');
  });
});

describe('renderMarkdown (end-to-end)', () => {
  it('파이프라인 통과: 마크다운 → 안전 HTML', () => {
    const md = '# Title\n\n![img](./pic.png)\n\n```js\nconsole.log(1);\n```\n';
    const out = renderMarkdown(md, 'tab-x');
    expect(out).toContain('<h1>Title</h1>');
    expect(out).toContain('diagrade-asset://tab-x/');
    expect(out).toMatch(/language-js/);
  });

  it('마크다운 안의 javascript URL 은 href 로 렌더되지 않음', () => {
    // markdown-it 은 unsafe scheme 의 [text](url) 를 링크로 만들지 않는다.
    // DOMPurify 도 javascript: href 를 거부 (defense-in-depth).
    // 텍스트 형태로 'javascript:' 가 남는 건 무해 — 클릭 컨텍스트가 아님.
    const md = '[click](javascript:alert(1))';
    const out = renderMarkdown(md, 'tab-x');
    expect(out).not.toMatch(/<a[^>]*href="javascript:/i);
  });

  it('마크다운 안의 raw script 는 escape + sanitize 양쪽으로 막힘', () => {
    const md = '<script>alert(1)</script>';
    const out = renderMarkdown(md, 'tab-x');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('alert(1);');
  });
});
