import { describe, it, expect } from 'vitest';
import { suggestedPdfFileName } from '../../src/renderer/export/suggestedFilename';

describe('suggestedPdfFileName (FR-36)', () => {
  it('탭 경로의 basename 에서 .md 제거 후 .pdf', () => {
    expect(suggestedPdfFileName('/x/report.md')).toBe('report.pdf');
  });

  it('.markdown 확장자도 처리', () => {
    expect(suggestedPdfFileName('/x/notes.markdown')).toBe('notes.pdf');
  });

  it('대소문자 무관 (.MD)', () => {
    expect(suggestedPdfFileName('/x/REPORT.MD')).toBe('REPORT.pdf');
  });

  it('Windows 경로', () => {
    expect(suggestedPdfFileName('C:\\docs\\report.md')).toBe('report.pdf');
  });

  it('한국어 파일명 보존', () => {
    expect(suggestedPdfFileName('/x/보고서.md')).toBe('보고서.pdf');
  });

  it('활성 탭 부재 시 fallback document.pdf', () => {
    expect(suggestedPdfFileName(null)).toBe('document.pdf');
  });
});
