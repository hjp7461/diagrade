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
  // PRD-005: 색은 theme.css 의 .diagrade-mermaid-error 에서 관리. layout 만 inline.
  const container = document.createElement('div');
  container.className = MERMAID_ERROR_CLASS;
  Object.assign(container.style, {
    padding: '12px',
    borderRadius: '4px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    margin: '12px 0'
  } as Partial<CSSStyleDeclaration>);

  const title = document.createElement('strong');
  title.textContent = '다이어그램 렌더 실패';
  container.appendChild(title);

  const msg = document.createElement('p');
  msg.className = 'diagrade-mermaid-error-message';
  Object.assign(msg.style, {
    margin: '8px 0',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: '13px',
    whiteSpace: 'pre-wrap'
  } as Partial<CSSStyleDeclaration>);
  msg.textContent = errorMessage;
  container.appendChild(msg);

  // PRD-012: 사용자가 무엇을 시도해야 할지 한 줄 안내. 메시지 원문은 위 <p> 에 그대로.
  const hint = document.createElement('p');
  hint.className = 'diagrade-mermaid-error-hint';
  Object.assign(hint.style, {
    margin: '4px 0 8px',
    fontSize: '12px',
    opacity: '0.85'
  } as Partial<CSSStyleDeclaration>);
  hint.textContent =
    'mermaid 문법 오류이거나 지원되지 않는 패턴일 수 있습니다. 아래 원본 코드를 확인하거나 mermaid live editor (https://mermaid.live) 로 검증해 주세요.';
  container.appendChild(hint);

  const codeWrapper = document.createElement('pre');
  Object.assign(codeWrapper.style, {
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

/**
 * mermaid 가 반환한 SVG 문자열을 SVGElement 로 파싱.
 *
 * **HTML 파서 사용** (이전: image/svg+xml strict XML).
 * 이유: mermaid flowchart 는 라벨에 `<foreignObject>` + HTML 을 사용하고, 그 HTML 안에는
 * void 요소(`<br>`)가 self-close 없이 들어간다. strict XML 파서는 첫 `<br>` 에서 mismatch
 * 로 실패 — `_ANALYSIS/` 의 한글 분석 마크다운이 fallback 박스(`SVG 파싱 실패`)로 떨어진
 * PRD-012 Issue A 의 실 원인.
 *
 * HTML 파서는 `<svg>` root 를 만나면 자동으로 SVG namespace 로 전환하므로 결과 element 의
 * 동작 (transform, viewBox, getBoundingClientRect, querySelector 등) 은 strict XML 파싱과
 * 동일.
 *
 * Export 경로 (`serializeSvg.ts`) 는 별개 — `XMLSerializer` 로 strict XML 호환을 만들어
 * 외부 뷰어 호환성을 보장한다 (`.claude/rules/export-svg-png.md`).
 */
function parseSvg(svg: string): SVGElement | null {
  const doc = new DOMParser().parseFromString(svg, 'text/html');
  const root = doc.body.querySelector('svg');
  if (!root) return null;
  return root;
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

/** 테스트용 export — buildErrorFallback 의 DOM 구조 + parseSvg 의 HTML 파서 동작 검증. */
export const __test__ = { buildErrorFallback, parseSvg };
