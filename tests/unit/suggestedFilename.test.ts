import { describe, it, expect } from 'vitest';
import { suggestedDiagramFileName } from '../../src/renderer/export/suggestedFilename';

describe('suggestedDiagramFileName (FR-27, §6.4)', () => {
  it('탭 경로의 basename 에서 .md 제거 후 인덱스 부여', () => {
    expect(suggestedDiagramFileName('/Users/x/report.md', 1, 'svg')).toBe('report-1.svg');
    expect(suggestedDiagramFileName('/Users/x/report.md', 3, 'png')).toBe('report-3.png');
  });

  it('.markdown 확장자도 처리', () => {
    expect(suggestedDiagramFileName('/x/notes.markdown', 1, 'svg')).toBe('notes-1.svg');
  });

  it('대소문자 무관 (.MD, .Markdown)', () => {
    expect(suggestedDiagramFileName('/x/REPORT.MD', 1, 'svg')).toBe('REPORT-1.svg');
    expect(suggestedDiagramFileName('/x/Notes.Markdown', 2, 'png')).toBe('Notes-2.png');
  });

  it('Windows 경로의 basename', () => {
    expect(suggestedDiagramFileName('C:\\docs\\report.md', 1, 'svg')).toBe('report-1.svg');
  });

  it('확장자 없는 경로는 그대로 사용 (드물지만 가능)', () => {
    expect(suggestedDiagramFileName('/x/anyname', 1, 'svg')).toBe('anyname-1.svg');
  });

  it('한국어 파일명 보존', () => {
    expect(suggestedDiagramFileName('/x/보고서.md', 5, 'png')).toBe('보고서-5.png');
  });

  it('활성 탭 부재 시 fallback diagram-{N}', () => {
    expect(suggestedDiagramFileName(null, 1, 'svg')).toBe('diagram-1.svg');
    expect(suggestedDiagramFileName(null, 7, 'png')).toBe('diagram-7.png');
  });

  it('인덱스 1 부터 (1-based, 0 은 사용처 책임)', () => {
    // 우리 의도는 1-based 입력. 이 함수는 입력대로 출력.
    expect(suggestedDiagramFileName('/x/a.md', 1, 'svg')).toContain('-1.svg');
  });
});
