import { getMermaid } from './init';
import type { EffectiveTheme } from '../theme/computeEffectiveTheme';

/** 에러 fallback 노드를 식별하는 클래스. M5 의 export 메뉴 주입이 이 클래스를 보고 건너뛴다 (FR-28). */
export const MERMAID_ERROR_CLASS = 'diagrade-mermaid-error';

/** 정상 렌더된 mermaid 컨테이너. M5 에서 export 메뉴를 여기에만 주입. */
export const MERMAID_CONTAINER_CLASS = 'diagrade-mermaid';

export function isMermaidErrorNode(el: Element): boolean {
  return el.classList.contains(MERMAID_ERROR_CLASS);
}

function makeId(): string {
  // mermaid.render 는 SVG id 로 이걸 사용. CSS selector 안전한 prefix.
  return `mermaid-${crypto.randomUUID()}`;
}

function buildErrorFallback(originalCode: string, errorMessage: string): HTMLElement {
  // FR-08: 원본 코드 + 오류 메시지 표시.
  const container = document.createElement('div');
  container.className = MERMAID_ERROR_CLASS;
  Object.assign(container.style, {
    padding: '12px',
    background: '#fff5f5',
    border: '1px solid #fed7d7',
    borderRadius: '4px',
    color: '#c53030',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    margin: '12px 0'
  } as Partial<CSSStyleDeclaration>);

  const title = document.createElement('strong');
  title.textContent = '다이어그램 렌더 실패';
  container.appendChild(title);

  const msg = document.createElement('p');
  Object.assign(msg.style, {
    margin: '8px 0',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: '13px',
    color: '#742a2a',
    whiteSpace: 'pre-wrap'
  } as Partial<CSSStyleDeclaration>);
  msg.textContent = errorMessage;
  container.appendChild(msg);

  const codeWrapper = document.createElement('pre');
  Object.assign(codeWrapper.style, {
    background: '#fff',
    padding: '8px',
    borderRadius: '4px',
    overflow: 'auto',
    margin: '0'
  } as Partial<CSSStyleDeclaration>);
  const code = document.createElement('code');
  code.textContent = originalCode;
  codeWrapper.appendChild(code);
  container.appendChild(codeWrapper);

  return container;
}

function parseSvg(svg: string): SVGElement | null {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== 'svg') return null;
  if (root.querySelector('parsererror') !== null) return null;
  return root as unknown as SVGElement;
}

/**
 * 컨테이너 내 모든 `code.language-mermaid` 를 mermaid 다이어그램으로 교체.
 *
 * 각 블록:
 *   - mermaid.render 성공 → SVG 를 sanitize 후 .diagrade-mermaid wrapper 에 넣어 교체
 *   - mermaid.render 실패 → 원본 코드 + 에러 메시지 fallback (FR-08)
 *
 * Shiki 와의 순서: applyHighlight 가 .language-mermaid 를 SKIP 하므로 어느 쪽 먼저든 무관.
 * 단 호출자(MarkdownView)는 mermaid → Shiki 순서로 호출해 DOM 변경 race 를 단순화한다.
 */
export async function renderMermaidBlocks(
  container: HTMLElement,
  theme: EffectiveTheme = 'light'
): Promise<void> {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('code.language-mermaid'));
  if (blocks.length === 0) return;

  let mermaid: Awaited<ReturnType<typeof getMermaid>>;
  try {
    mermaid = await getMermaid(theme);
  } catch (e) {
    // mermaid 자체 로드 실패 — 모든 블록을 에러 fallback 으로
    for (const codeEl of blocks) {
      const pre = codeEl.parentElement;
      if (!pre || pre.tagName !== 'PRE') continue;
      const msg = e instanceof Error ? e.message : String(e);
      pre.replaceWith(buildErrorFallback(codeEl.textContent ?? '', `mermaid 로드 실패: ${msg}`));
    }
    return;
  }

  for (const codeEl of blocks) {
    const pre = codeEl.parentElement;
    if (!pre || pre.tagName !== 'PRE') continue;

    const source = codeEl.textContent ?? '';
    const id = makeId();

    try {
      // Mermaid 출력은 신뢰 (sanitize.ts 의 신뢰 결정 주석 참조).
      const { svg } = await mermaid.render(id, source);
      const svgEl = parseSvg(svg);

      if (!svgEl) {
        pre.replaceWith(buildErrorFallback(source, 'SVG 파싱 실패'));
        continue;
      }

      const wrapper = document.createElement('div');
      wrapper.className = MERMAID_CONTAINER_CLASS;
      wrapper.appendChild(svgEl);
      pre.replaceWith(wrapper);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      pre.replaceWith(buildErrorFallback(source, msg));
    }
  }
}

/** 테스트용 export — buildErrorFallback 의 DOM 구조 검증. */
export const __test__ = { buildErrorFallback };
