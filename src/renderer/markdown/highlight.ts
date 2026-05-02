/**
 * Shiki 코드 하이라이트. FR-03 (P1) — lazy-load.
 *
 * import('shiki') 는 dynamic 이라 Vite 가 별도 청크로 분리한다 (NFR-03 의
 * "1 MB 마크다운 ≤ 2 초" 를 코드 하이라이트가 먹지 않게).
 *
 * 적용 시점: 본문 렌더링 후. 마크다운이 먼저 보이고 코드가 점진 강조됨.
 *
 * Mermaid 블록은 건너뛴다 (M4 의 mermaid.run 이 처리).
 *
 * Shiki 출력 신뢰: shiki 는 token escape 가 검증된 mature 라이브러리.
 * Shiki 결과를 DOMParser 로 파싱해 element 로 삽입한다 (innerHTML 직접 할당 회피).
 */

type ShikiModule = typeof import('shiki');
type Highlighter = Awaited<ReturnType<ShikiModule['createHighlighter']>>;

const PRELOADED_LANGS = [
  'typescript', 'javascript', 'tsx', 'jsx',
  'python', 'ruby', 'rust', 'go', 'java', 'c', 'cpp', 'csharp', 'kotlin', 'swift',
  'json', 'yaml', 'toml', 'xml',
  'bash', 'shell', 'powershell',
  'css', 'html', 'sql',
  'markdown', 'diff'
] as const;

const SKIP_LANGS = new Set(['mermaid']);
const LIGHT_THEME = 'github-light';
const DARK_THEME = 'github-dark';

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const shiki = await import('shiki');
      return shiki.createHighlighter({
        themes: [LIGHT_THEME, DARK_THEME],
        langs: [...PRELOADED_LANGS]
      });
    })();
  }
  return highlighterPromise;
}

/**
 * Shiki 의 HTML 문자열을 element 로 변환. innerHTML 직접 할당을 피해
 * DOMParser → 첫 자식 element 추출 패턴 사용.
 */
function htmlToElement(html: string): Element | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.firstElementChild;
}

export async function applyHighlight(container: HTMLElement): Promise<void> {
  const codeBlocks = container.querySelectorAll<HTMLElement>(
    'pre > code[class*="language-"]'
  );
  if (codeBlocks.length === 0) return;

  let h: Highlighter;
  try {
    h = await getHighlighter();
  } catch {
    return;
  }

  const loaded = new Set(h.getLoadedLanguages());

  codeBlocks.forEach((codeEl) => {
    const langMatch = codeEl.className.match(/language-([\w+-]+)/);
    const lang = langMatch?.[1] ?? '';
    if (!lang || SKIP_LANGS.has(lang) || !loaded.has(lang)) return;

    const pre = codeEl.parentElement;
    if (!pre || pre.tagName !== 'PRE') return;

    try {
      const html = h.codeToHtml(codeEl.textContent ?? '', {
        lang,
        themes: { light: LIGHT_THEME, dark: DARK_THEME }
      });
      const replacement = htmlToElement(html);
      if (replacement) pre.replaceWith(replacement);
    } catch {
      // language load 실패 등 — 평문 코드 블록 그대로 유지
    }
  });
}
