import { basenameOfPath } from '../path';

/**
 * 저장 대화상자 기본 파일명. FR-27, §6.4.
 *
 * 형식: `{원본 md basename without ext}-{1-based 순번}.{svg|png}`.
 * 활성 탭이 없으면 fallback `diagram-{N}.{ext}`.
 *
 * OS 가 금지하는 문자 검증은 dialog.showSaveDialog 에 위임 (CLAUDE.md pitfall #6).
 */
export function suggestedDiagramFileName(
  activeTabPath: string | null,
  oneBasedIndex: number,
  ext: 'svg' | 'png'
): string {
  if (!activeTabPath) {
    return `diagram-${oneBasedIndex}.${ext}`;
  }
  const base = basenameOfPath(activeTabPath).replace(/\.(md|markdown)$/i, '');
  return `${base}-${oneBasedIndex}.${ext}`;
}
