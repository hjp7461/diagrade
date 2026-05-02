import { serializeSvg } from './serializeSvg';
import { suggestedDiagramFileName } from './suggestedFilename';
import type { SaveDialogFilter } from '../../shared/types';

const CHART_CLASS = 'diagrade-mermaid';
const SVG_FILTER: SaveDialogFilter = { name: 'SVG', extensions: ['svg'] };

export interface SaveAllResult {
  /** 디스크에 실제로 저장된 차트 수 */
  saved: number;
  /** 사용자가 취소한 차트의 1-based 인덱스. 끝까지 완료했으면 null. */
  cancelledAt: number | null;
  /** 컨테이너에 정상 mermaid 차트가 0 개였으면 true (FR-35) */
  noCharts: boolean;
}

export interface SaveAllDeps {
  saveFile: (defaultName: string, filters: SaveDialogFilter[]) => Promise<string | null>;
  writeText: (path: string, content: string) => Promise<void>;
}

/**
 * 컨테이너 내 정상 mermaid 다이어그램들을 SVG 로 일괄 저장. FR-32~35.
 *
 * - 인덱스는 정상 차트만 1-based 순번 (에러 fallback 은 제외).
 * - 차트별로 순차 save 대화상자 (FR-33). 사용자가 취소하면 부분 저장 결과 보존.
 * - 0 개 차트면 saved=0, noCharts=true 반환 (FR-35) — 호출자가 안내 결정.
 * - 의존성 주입으로 jsdom 에서 mock 테스트 가능.
 */
export async function saveAllDiagrams(
  container: HTMLElement,
  activeTabPath: string | null,
  deps: SaveAllDeps
): Promise<SaveAllResult> {
  const charts = Array.from(
    container.querySelectorAll<HTMLElement>(`.${CHART_CLASS}`)
  );
  if (charts.length === 0) {
    return { saved: 0, cancelledAt: null, noCharts: true };
  }

  let saved = 0;
  for (let i = 0; i < charts.length; i++) {
    const oneBasedIndex = i + 1;
    const svg = charts[i]!.querySelector('svg');
    if (!svg) continue;

    const filename = suggestedDiagramFileName(activeTabPath, oneBasedIndex, 'svg');
    const targetPath = await deps.saveFile(filename, [SVG_FILTER]);
    if (!targetPath) {
      // FR-33: 사용자 취소 → 즉시 중단. 이미 저장된 것은 보존.
      return { saved, cancelledAt: oneBasedIndex, noCharts: false };
    }

    const xml = serializeSvg(svg as unknown as SVGSVGElement);
    await deps.writeText(targetPath, xml);
    saved++;
  }

  return { saved, cancelledAt: null, noCharts: false };
}
