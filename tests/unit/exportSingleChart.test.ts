/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import {
  exportSingleChart,
  type ExportSingleDeps
} from '../../src/renderer/export/exportSingleChart';

const SVG_NS = 'http://www.w3.org/2000/svg';

function fakeSvg(): SVGSVGElement {
  return document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
}

interface MockDeps extends Required<Omit<ExportSingleDeps, 'serialize' | 'svgToPng'>> {
  serialize: ReturnType<typeof vi.fn>;
  svgToPng: ReturnType<typeof vi.fn>;
}

function makeDeps(overrides: Partial<MockDeps> = {}): MockDeps {
  return {
    saveFile: vi.fn().mockResolvedValue('/tmp/x.png'),
    writeText: vi.fn().mockResolvedValue(undefined),
    writeBinary: vi.fn().mockResolvedValue(undefined),
    serialize: vi.fn().mockReturnValue('<svg/>'),
    svgToPng: vi.fn().mockResolvedValue('data:image/png;base64,QUJD'),
    ...overrides
  };
}

describe('exportSingleChart — PNG 실패 경로 (PRD-016)', () => {
  it('svgToPng 가 빈 dataURL 반환 → throw, writeBinary 미호출', async () => {
    const d = makeDeps({ svgToPng: vi.fn().mockResolvedValue('') });
    await expect(
      exportSingleChart(fakeSvg(), 1, '/x/note.md', 'png', 2, d)
    ).rejects.toThrow();
    expect(d.writeBinary).not.toHaveBeenCalled();
  });

  it("svgToPng 가 'data:' 만 반환 → throw, writeBinary 미호출", async () => {
    const d = makeDeps({ svgToPng: vi.fn().mockResolvedValue('data:') });
    await expect(
      exportSingleChart(fakeSvg(), 1, '/x/note.md', 'png', 2, d)
    ).rejects.toThrow();
    expect(d.writeBinary).not.toHaveBeenCalled();
  });

  it('svgToPng 가 잘못된 prefix → throw, writeBinary 미호출', async () => {
    const d = makeDeps({
      svgToPng: vi.fn().mockResolvedValue('data:image/jpeg;base64,XYZ')
    });
    await expect(
      exportSingleChart(fakeSvg(), 1, '/x/note.md', 'png', 2, d)
    ).rejects.toThrow();
    expect(d.writeBinary).not.toHaveBeenCalled();
  });

  it('svgToPng 가 reject → throw 그대로 전파, writeBinary 미호출', async () => {
    const d = makeDeps({
      svgToPng: vi.fn().mockRejectedValue(new Error('canvas tainted'))
    });
    await expect(
      exportSingleChart(fakeSvg(), 1, '/x/note.md', 'png', 2, d)
    ).rejects.toThrow('canvas tainted');
    expect(d.writeBinary).not.toHaveBeenCalled();
  });

  it("PNG dataURL 본문이 빈 base64 ('data:image/png;base64,') → throw", async () => {
    const d = makeDeps({
      svgToPng: vi.fn().mockResolvedValue('data:image/png;base64,')
    });
    await expect(
      exportSingleChart(fakeSvg(), 1, '/x/note.md', 'png', 2, d)
    ).rejects.toThrow();
    expect(d.writeBinary).not.toHaveBeenCalled();
  });
});

describe('exportSingleChart — happy path 회귀 가드 (PRD-001 §6.4)', () => {
  it('PNG 정상 dataURL → writeBinary 가 base64 본문 (prefix 제거) 으로 호출', async () => {
    const d = makeDeps();
    const r = await exportSingleChart(fakeSvg(), 1, '/x/note.md', 'png', 2, d);
    expect(r.saved).toBe(true);
    expect(d.writeBinary).toHaveBeenCalledWith('/tmp/x.png', 'QUJD');
    expect(d.writeText).not.toHaveBeenCalled();
  });

  it('SVG → writeText 가 직렬화 결과로 호출', async () => {
    const d = makeDeps({
      saveFile: vi.fn().mockResolvedValue('/tmp/x.svg')
    });
    const r = await exportSingleChart(fakeSvg(), 1, '/x/note.md', 'svg', 2, d);
    expect(r.saved).toBe(true);
    expect(d.writeText).toHaveBeenCalledWith('/tmp/x.svg', '<svg/>');
    expect(d.writeBinary).not.toHaveBeenCalled();
  });

  it('사용자 다이얼로그 취소 → saved=false, write 미호출', async () => {
    const d = makeDeps({
      saveFile: vi.fn().mockResolvedValue(null)
    });
    const r = await exportSingleChart(fakeSvg(), 1, '/x/note.md', 'png', 2, d);
    expect(r.saved).toBe(false);
    expect(d.writeBinary).not.toHaveBeenCalled();
    expect(d.writeText).not.toHaveBeenCalled();
  });
});
