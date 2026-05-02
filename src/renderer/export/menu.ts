import { serializeSvg } from './serializeSvg';
import { svgToPngDataUrl } from './svgToPngDataUrl';
import { suggestedDiagramFileName } from './suggestedFilename';

/**
 * Mermaid 차트 옆에 ⬇ PNG / ⬇ SVG export 메뉴를 주입. FR-21~31.
 *
 * 정책:
 *   - `.diagrade-mermaid` (정상 렌더) 에만 주입. `.diagrade-mermaid-error` 는 건너뜀 (FR-28).
 *   - 같은 차트에 두 번 주입 금지 (idempotent).
 *   - 인덱스는 컨테이너 내 `.diagrade-mermaid` 의 1-based 순서. 에러 블록은 인덱스에서 제외.
 *   - 클릭 시 FR-30 의 ⏳ 생성 중… + disabled, try/finally 로 원복.
 *
 * CSS 는 menu.css 가 담당 (호버 페이드, @media print 숨김).
 */

const MENU_CLASS = 'diagrade-export-menu';
const BUTTON_CLASS = 'diagrade-export-button';
const CHART_CLASS = 'diagrade-mermaid';

interface InjectOptions {
  activeTabPath: string | null;
}

export function injectExportMenus(container: HTMLElement, options: InjectOptions): void {
  const charts = Array.from(container.querySelectorAll<HTMLElement>(`.${CHART_CLASS}`));
  charts.forEach((chart, idx) => {
    if (chart.querySelector(`.${MENU_CLASS}`)) return;
    chart.appendChild(buildMenu(chart, idx + 1, options.activeTabPath));
  });
}

function buildMenu(
  chart: HTMLElement,
  oneBasedIndex: number,
  activeTabPath: string | null
): HTMLElement {
  const menu = document.createElement('div');
  menu.className = MENU_CLASS;
  menu.appendChild(
    makeButton('⬇ PNG', () => exportChart(chart, oneBasedIndex, activeTabPath, 'png'))
  );
  menu.appendChild(
    makeButton('⬇ SVG', () => exportChart(chart, oneBasedIndex, activeTabPath, 'svg'))
  );
  return menu;
}

function makeButton(label: string, onClick: () => Promise<void>): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = BUTTON_CLASS;
  btn.textContent = label;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (btn.disabled) return;
    // FR-30: 클릭 즉시 ⏳ + disabled. try/finally 로 비동기 실패에도 영구 잠김 방지.
    btn.disabled = true;
    btn.textContent = '⏳ 생성 중…';
    try {
      await onClick();
    } catch (err) {
      console.error('export failed:', err);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
  return btn;
}

async function exportChart(
  chart: HTMLElement,
  oneBasedIndex: number,
  activeTabPath: string | null,
  ext: 'svg' | 'png'
): Promise<void> {
  const svg = chart.querySelector('svg');
  if (!svg) {
    console.warn('SVG not found in mermaid chart');
    return;
  }

  const defaultName = suggestedDiagramFileName(activeTabPath, oneBasedIndex, ext);
  const filter =
    ext === 'svg'
      ? { name: 'SVG', extensions: ['svg'] }
      : { name: 'PNG', extensions: ['png'] };

  const targetPath = await window.diagrade.dialog.saveFile(defaultName, [filter]);
  if (!targetPath) return;

  if (ext === 'svg') {
    const xml = serializeSvg(svg as unknown as SVGSVGElement);
    await window.diagrade.fs.writeText(targetPath, xml);
  } else {
    const dataUrl = await svgToPngDataUrl(svg as unknown as SVGSVGElement, 2);
    const base64 = dataUrl.split(',')[1] ?? '';
    await window.diagrade.fs.writeBinary(targetPath, base64);
  }
}

/** 테스트용 — 메뉴 주입의 멱등성, 인덱스 계산을 검증. */
export const __test__ = {
  MENU_CLASS,
  BUTTON_CLASS,
  CHART_CLASS
};
