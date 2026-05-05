import { serializeSvg } from './serializeSvg';
import { suggestedDiagramFileName } from './suggestedFilename';
import { extractPngBase64 } from './pngBase64';
import type { PngScale, SaveDialogFilter } from '../../shared/types';

const CHART_CLASS = 'diagrade-mermaid';
const SVG_FILTER: SaveDialogFilter = { name: 'SVG', extensions: ['svg'] };
const PNG_FILTER: SaveDialogFilter = { name: 'PNG', extensions: ['png'] };

export interface SaveAllResult {
  /** 디스크에 실제로 저장된 차트 수 */
  saved: number;
  /** PRD-016: 다이얼로그 통과 후 변환·쓰기 단계에서 실패한 차트 수 (사용자 취소와 구분). */
  failed: number;
  /** 사용자가 취소한 차트의 1-based 인덱스. 끝까지 완료했으면 null. */
  cancelledAt: number | null;
  /** 컨테이너에 정상 mermaid 차트가 0 개였으면 true (FR-35) */
  noCharts: boolean;
}

export interface SaveAllDeps {
  saveFile: (defaultName: string, filters: SaveDialogFilter[]) => Promise<string | null>;
  writeText: (path: string, content: string) => Promise<void>;
  /** PRD-008: PNG 일괄 시에만 호출. SVG 모드에서는 미사용. */
  writeBinary?: (path: string, base64: string) => Promise<void>;
}

export interface SaveAllOptions {
  /** 'svg' (default, PRD-001) | 'png' (PRD-008). */
  format?: 'svg' | 'png';
  /** PRD-006/008: PNG 배율. format='png' 일 때만 의미 있음. default 2. */
  pngScale?: PngScale;
  /**
   * PRD-008 §6.3: 테스트용 seam.
   * production 은 export/svgToPngDataUrl 을 주입.
   * jsdom 단위 테스트는 mock 으로 대체해 svg→png 변환의 brittle 한 부분
   * (URL.createObjectURL, <img>.onload) 회피.
   */
  svgToPng?: (svg: SVGSVGElement, scale: number) => Promise<string>;
}

/**
 * 컨테이너 내 정상 mermaid 다이어그램들을 일괄 저장. PRD-001 FR-32~35 + PRD-008.
 *
 * - 인덱스는 정상 차트만 1-based 순번 (에러 fallback 은 제외).
 * - 차트별로 순차 save 대화상자 (FR-33). 사용자가 취소하면 부분 저장 결과 보존.
 * - 0 개 차트면 saved=0, noCharts=true 반환 (FR-35) — 호출자가 안내 결정.
 * - format default 'svg' — 기존 호출자 호환.
 */
export async function saveAllDiagrams(
  container: HTMLElement,
  activeTabPath: string | null,
  deps: SaveAllDeps,
  options: SaveAllOptions = {}
): Promise<SaveAllResult> {
  const format = options.format ?? 'svg';
  const charts = Array.from(
    container.querySelectorAll<HTMLElement>(`.${CHART_CLASS}`)
  );
  if (charts.length === 0) {
    return { saved: 0, failed: 0, cancelledAt: null, noCharts: true };
  }

  const filter = format === 'svg' ? SVG_FILTER : PNG_FILTER;

  // 프로그래머 오류는 루프 진입 전에 한 번만 검증 — 매 차트마다 throw 하지 않도록.
  if (format === 'png' && (!deps.writeBinary || !options.svgToPng)) {
    throw new Error('PNG 일괄 저장에는 deps.writeBinary 와 options.svgToPng 가 필요합니다.');
  }

  let saved = 0;
  let failed = 0;
  for (let i = 0; i < charts.length; i++) {
    const oneBasedIndex = i + 1;
    const svg = charts[i]!.querySelector('svg');
    if (!svg) continue;

    const filename = suggestedDiagramFileName(activeTabPath, oneBasedIndex, format);
    const targetPath = await deps.saveFile(filename, [filter]);
    if (!targetPath) {
      // FR-33: 사용자 취소 → 즉시 중단. 이미 저장된 것은 보존.
      return { saved, failed, cancelledAt: oneBasedIndex, noCharts: false };
    }

    // PRD-016: 차트별 try/catch 로 부분 실패가 다른 차트의 진행을 막지 않게.
    try {
      if (format === 'svg') {
        const xml = serializeSvg(svg as unknown as SVGSVGElement);
        await deps.writeText(targetPath, xml);
      } else {
        // PRD-008 FR-08: pngScale 적용. svgToPng 헬퍼는 production 에서 주입,
        // 테스트는 mock. base64 추출은 단일 PNG 흐름과 동일 helper (`extractPngBase64`).
        const dataUrl = await options.svgToPng!(svg as unknown as SVGSVGElement, options.pngScale ?? 2);
        const base64 = extractPngBase64(dataUrl);
        await deps.writeBinary!(targetPath, base64);
      }
      saved++;
    } catch (err) {
      console.error(`saveAllDiagrams[${oneBasedIndex}] 저장 실패:`, err);
      failed++;
    }
  }

  return { saved, failed, cancelledAt: null, noCharts: false };
}
