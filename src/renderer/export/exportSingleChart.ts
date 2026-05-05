import { serializeSvg } from './serializeSvg';
import { svgToPngDataUrl } from './svgToPngDataUrl';
import { suggestedDiagramFileName } from './suggestedFilename';
import { extractPngBase64 } from './pngBase64';
import type { PngScale, SaveDialogFilter } from '../../shared/types';

/**
 * 단일 mermaid 차트의 SVG/PNG 저장 파이프라인. PRD-001 §6.4, PRD-006, PRD-011.
 *
 * 호출자: ⬇ PNG / ⬇ SVG 호버 메뉴(menu.ts), 확대보기 다이얼로그(DiagramZoomDialog).
 * 일괄 저장(saveAllDiagrams)은 cancellation 흐름이 달라 별도 — 단일 차트 책임만 여기.
 *
 * 직렬화 / PNG 변환은 export/* 의 헬퍼만 통과 — `.claude/rules/export-svg-png.md`
 * (XMLSerializer 강제, viewBox 기반 크기, BOM 금지) 정책을 한 곳에서 보장.
 */
export interface ExportSingleDeps {
  saveFile: (defaultName: string, filters: SaveDialogFilter[]) => Promise<string | null>;
  writeText: (path: string, content: string) => Promise<void>;
  writeBinary: (path: string, base64: string) => Promise<void>;
  /** 테스트 seam — production 은 미지정 시 export/serializeSvg 사용. */
  serialize?: (svg: SVGSVGElement) => string;
  /** 테스트 seam — production 은 미지정 시 export/svgToPngDataUrl 사용. */
  svgToPng?: (svg: SVGSVGElement, scale: number) => Promise<string>;
}

export interface ExportSingleResult {
  /** 사용자가 다이얼로그를 취소했으면 false. 저장됐으면 true. */
  saved: boolean;
}

const SVG_FILTER: SaveDialogFilter = { name: 'SVG', extensions: ['svg'] };
const PNG_FILTER: SaveDialogFilter = { name: 'PNG', extensions: ['png'] };

export async function exportSingleChart(
  svg: SVGSVGElement,
  oneBasedIndex: number,
  activeTabPath: string | null,
  ext: 'svg' | 'png',
  pngScale: PngScale,
  deps: ExportSingleDeps
): Promise<ExportSingleResult> {
  const serialize = deps.serialize ?? serializeSvg;
  const toPng = deps.svgToPng ?? svgToPngDataUrl;
  const defaultName = suggestedDiagramFileName(activeTabPath, oneBasedIndex, ext);
  const filter = ext === 'svg' ? SVG_FILTER : PNG_FILTER;

  const target = await deps.saveFile(defaultName, [filter]);
  if (!target) return { saved: false };

  if (ext === 'svg') {
    await deps.writeText(target, serialize(svg));
  } else {
    // PRD-016: extractPngBase64 가 빈/비정상 dataURL 을 throw 로 차단 — 0 바이트 파일이
    // 디스크에 닿지 않도록 renderer 측 1 차 방어. main 의 writeBinaryFile 도 자체 방어.
    const dataUrl = await toPng(svg, pngScale);
    const base64 = extractPngBase64(dataUrl);
    await deps.writeBinary(target, base64);
  }
  return { saved: true };
}
