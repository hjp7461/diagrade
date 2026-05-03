/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveAllDiagrams } from '../../src/renderer/export/saveAllDiagrams';

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildContainer(specs: ('chart' | 'error' | 'chart-no-svg')[]): HTMLDivElement {
  const root = document.createElement('div');
  for (const kind of specs) {
    if (kind === 'chart') {
      const c = document.createElement('div');
      c.className = 'diagrade-mermaid';
      const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
      svg.setAttribute('viewBox', '0 0 100 100');
      c.appendChild(svg);
      root.appendChild(c);
    } else if (kind === 'error') {
      const c = document.createElement('div');
      c.className = 'diagrade-mermaid-error';
      root.appendChild(c);
    } else if (kind === 'chart-no-svg') {
      // 비정상 — diagrade-mermaid 클래스인데 svg 없는 (이론상 안 나오지만 robustness 검증)
      const c = document.createElement('div');
      c.className = 'diagrade-mermaid';
      root.appendChild(c);
    }
  }
  document.body.replaceChildren(root);
  return root;
}

describe('saveAllDiagrams (FR-32~35)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('FR-35: 정상 차트 0 개 — noCharts: true, saveFile 호출 안 함', async () => {
    const container = buildContainer(['error']);
    const saveFile = vi.fn();
    const writeText = vi.fn();
    const r = await saveAllDiagrams(container, '/x/note.md', { saveFile, writeText });
    expect(r).toEqual({ saved: 0, cancelledAt: null, noCharts: true });
    expect(saveFile).not.toHaveBeenCalled();
  });

  it('각 차트마다 순차 saveFile + writeText, 완료 시 saved=N', async () => {
    const container = buildContainer(['chart', 'chart', 'chart']);
    let count = 0;
    const saveFile = vi.fn().mockImplementation(async (defaultName) => {
      count++;
      return `/tmp/${defaultName}`;
    });
    const writeText = vi.fn().mockResolvedValue(undefined);

    const r = await saveAllDiagrams(container, '/x/report.md', { saveFile, writeText });

    expect(r).toEqual({ saved: 3, cancelledAt: null, noCharts: false });
    expect(saveFile).toHaveBeenCalledTimes(3);
    expect(writeText).toHaveBeenCalledTimes(3);
    expect(count).toBe(3);
  });

  it('FR-34: 파일명 규칙 {basename}-{N}.svg, 1-based', async () => {
    const container = buildContainer(['chart', 'chart']);
    const seen: string[] = [];
    const saveFile = vi.fn().mockImplementation(async (defaultName) => {
      seen.push(defaultName);
      return `/tmp/${defaultName}`;
    });
    const writeText = vi.fn().mockResolvedValue(undefined);

    await saveAllDiagrams(container, '/Users/x/notes.md', { saveFile, writeText });
    expect(seen).toEqual(['notes-1.svg', 'notes-2.svg']);
  });

  it('FR-33: 첫 차트에서 사용자 취소 — saved=0, cancelledAt=1', async () => {
    const container = buildContainer(['chart', 'chart', 'chart']);
    const saveFile = vi.fn().mockResolvedValue(null); // 모두 취소
    const writeText = vi.fn();

    const r = await saveAllDiagrams(container, '/x/note.md', { saveFile, writeText });
    expect(r).toEqual({ saved: 0, cancelledAt: 1, noCharts: false });
    expect(saveFile).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('FR-33: 부분 저장 후 취소 — 이미 저장된 것은 보존', async () => {
    const container = buildContainer(['chart', 'chart', 'chart', 'chart']);
    let n = 0;
    const saveFile = vi.fn().mockImplementation(async (defaultName) => {
      n++;
      // 처음 2 개는 OK, 3 번째에서 취소
      return n <= 2 ? `/tmp/${defaultName}` : null;
    });
    const writeText = vi.fn().mockResolvedValue(undefined);

    const r = await saveAllDiagrams(container, '/x/note.md', { saveFile, writeText });
    expect(r).toEqual({ saved: 2, cancelledAt: 3, noCharts: false });
    expect(saveFile).toHaveBeenCalledTimes(3); // 1, 2 (저장), 3 (취소)
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('활성 탭 부재 시 fallback diagram-{N}.svg', async () => {
    const container = buildContainer(['chart']);
    const seen: string[] = [];
    const saveFile = vi.fn().mockImplementation(async (defaultName) => {
      seen.push(defaultName);
      return null;
    });
    await saveAllDiagrams(container, null, { saveFile, writeText: vi.fn() });
    expect(seen).toEqual(['diagram-1.svg']);
  });

  it('SVG 가 없는 비정상 차트는 skip, 다음 차트로 진행 (인덱스는 그대로 증가)', async () => {
    const container = buildContainer(['chart', 'chart-no-svg', 'chart']);
    const seen: string[] = [];
    const saveFile = vi.fn().mockImplementation(async (defaultName) => {
      seen.push(defaultName);
      return `/tmp/${defaultName}`;
    });
    const writeText = vi.fn().mockResolvedValue(undefined);

    const r = await saveAllDiagrams(container, '/x/note.md', { saveFile, writeText });
    // 1 번 차트 저장, 2 번 차트는 svg 없어 skip (saveFile 도 호출 안 됨), 3 번 차트 저장.
    expect(r.saved).toBe(2);
    expect(seen).toEqual(['note-1.svg', 'note-3.svg']);
  });

  it('error fallback 은 인덱스에서 제외 — chart 만 카운트', async () => {
    const container = buildContainer(['chart', 'error', 'chart']);
    const seen: string[] = [];
    const saveFile = vi.fn().mockImplementation(async (defaultName) => {
      seen.push(defaultName);
      return `/tmp/${defaultName}`;
    });
    const writeText = vi.fn().mockResolvedValue(undefined);

    await saveAllDiagrams(container, '/x/note.md', { saveFile, writeText });
    // error 는 카운트에서 제외 — 인덱스가 1, 2 만 (1, 3 이 아님)
    expect(seen).toEqual(['note-1.svg', 'note-2.svg']);
  });
});

describe('saveAllDiagrams (PRD-008: PNG 분기)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  function pngDeps() {
    return {
      saveFile: vi.fn(),
      writeText: vi.fn(),
      writeBinary: vi.fn().mockResolvedValue(undefined)
    };
  }

  function fakeSvgToPng(scale: number) {
    // base64 자리표시자 — 실제 디코딩은 안 함, base64 추출 로직만 검증.
    return vi.fn().mockResolvedValue(`data:image/png;base64,FAKE_S${scale}`);
  }

  it('format=png — svgToPng 호출, writeBinary 호출, writeText 미호출', async () => {
    const container = buildContainer(['chart', 'chart']);
    const deps = pngDeps();
    deps.saveFile.mockImplementation(async (name: string) => `/tmp/${name}`);
    const svgToPng = fakeSvgToPng(2);

    const r = await saveAllDiagrams(container, '/x/note.md', deps, {
      format: 'png',
      pngScale: 2,
      svgToPng
    });

    expect(r).toEqual({ saved: 2, cancelledAt: null, noCharts: false });
    expect(svgToPng).toHaveBeenCalledTimes(2);
    expect(deps.writeBinary).toHaveBeenCalledTimes(2);
    expect(deps.writeText).not.toHaveBeenCalled();
    // FR-08: scale 인수 forwarding
    expect(svgToPng.mock.calls[0]![1]).toBe(2);
  });

  it('FR-06: PNG 파일명 규칙 {basename}-{N}.png + filter 가 PNG only', async () => {
    const container = buildContainer(['chart', 'chart']);
    const deps = pngDeps();
    const seenNames: string[] = [];
    const seenFilters: unknown[] = [];
    deps.saveFile.mockImplementation(async (name: string, filters: unknown) => {
      seenNames.push(name);
      seenFilters.push(filters);
      return `/tmp/${name}`;
    });

    await saveAllDiagrams(container, '/Users/x/notes.md', deps, {
      format: 'png',
      pngScale: 2,
      svgToPng: fakeSvgToPng(2)
    });
    expect(seenNames).toEqual(['notes-1.png', 'notes-2.png']);
    // FR-10: PNG filter 만
    expect(seenFilters[0]).toEqual([{ name: 'PNG', extensions: ['png'] }]);
  });

  it('FR-08: pngScale 이 svgToPng 에 forwarding (default 2)', async () => {
    const container = buildContainer(['chart']);
    const deps = pngDeps();
    deps.saveFile.mockImplementation(async (name: string) => `/tmp/${name}`);
    const svgToPng = fakeSvgToPng(2);

    // pngScale 생략 시 default 2
    await saveAllDiagrams(container, '/x/n.md', deps, { format: 'png', svgToPng });
    expect(svgToPng.mock.calls[0]![1]).toBe(2);

    // pngScale=4 명시 시 forwarding
    const svgToPng4 = fakeSvgToPng(4);
    await saveAllDiagrams(container, '/x/n.md', deps, {
      format: 'png',
      pngScale: 4,
      svgToPng: svgToPng4
    });
    expect(svgToPng4.mock.calls[0]![1]).toBe(4);
  });

  it('FR-05: PNG 모드 첫 차트 취소 — svgToPng / writeBinary 미호출', async () => {
    const container = buildContainer(['chart', 'chart']);
    const deps = pngDeps();
    deps.saveFile.mockResolvedValue(null); // 취소
    const svgToPng = fakeSvgToPng(2);

    const r = await saveAllDiagrams(container, '/x/n.md', deps, {
      format: 'png',
      pngScale: 2,
      svgToPng
    });

    expect(r).toEqual({ saved: 0, cancelledAt: 1, noCharts: false });
    expect(svgToPng).not.toHaveBeenCalled();
    expect(deps.writeBinary).not.toHaveBeenCalled();
  });

  it('PNG base64 추출은 dataURL split(",")[1] — writeBinary 에 base64 전달', async () => {
    const container = buildContainer(['chart']);
    const deps = pngDeps();
    deps.saveFile.mockImplementation(async (name: string) => `/tmp/${name}`);
    const svgToPng = vi.fn().mockResolvedValue('data:image/png;base64,QUJD');

    await saveAllDiagrams(container, '/x/n.md', deps, {
      format: 'png',
      pngScale: 2,
      svgToPng
    });
    expect(deps.writeBinary).toHaveBeenCalledWith('/tmp/n-1.png', 'QUJD');
  });

  it('error fallback 은 PNG 모드에서도 인덱스 제외', async () => {
    const container = buildContainer(['chart', 'error', 'chart']);
    const deps = pngDeps();
    const seen: string[] = [];
    deps.saveFile.mockImplementation(async (name: string) => {
      seen.push(name);
      return `/tmp/${name}`;
    });

    await saveAllDiagrams(container, '/x/note.md', deps, {
      format: 'png',
      pngScale: 2,
      svgToPng: fakeSvgToPng(2)
    });
    expect(seen).toEqual(['note-1.png', 'note-2.png']);
  });

  it('FR-07: PNG fallback 파일명 diagram-{N}.png (활성 탭 부재)', async () => {
    const container = buildContainer(['chart']);
    const deps = pngDeps();
    const seen: string[] = [];
    deps.saveFile.mockImplementation(async (name: string) => {
      seen.push(name);
      return null;
    });

    await saveAllDiagrams(container, null, deps, {
      format: 'png',
      pngScale: 2,
      svgToPng: fakeSvgToPng(2)
    });
    expect(seen).toEqual(['diagram-1.png']);
  });

  it('FR-09: PNG 모드 0 개 차트 — noCharts=true, svgToPng 미호출', async () => {
    const container = buildContainer(['error']);
    const deps = pngDeps();
    const svgToPng = fakeSvgToPng(2);

    const r = await saveAllDiagrams(container, '/x/n.md', deps, {
      format: 'png',
      pngScale: 2,
      svgToPng
    });
    expect(r).toEqual({ saved: 0, cancelledAt: null, noCharts: true });
    expect(deps.saveFile).not.toHaveBeenCalled();
    expect(svgToPng).not.toHaveBeenCalled();
  });

  it('PNG 모드인데 deps.writeBinary 누락 시 throw — 프로그래머 오류 가시화', async () => {
    const container = buildContainer(['chart']);
    const deps = {
      saveFile: vi.fn().mockImplementation(async (n: string) => `/tmp/${n}`),
      writeText: vi.fn()
      // writeBinary 의도적 누락
    };

    await expect(
      saveAllDiagrams(container, '/x/n.md', deps, {
        format: 'png',
        pngScale: 2,
        svgToPng: fakeSvgToPng(2)
      })
    ).rejects.toThrow();
  });
});

describe('saveAllDiagrams (호환성: 기존 deps 객체 무손상)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('기존 호출 형태 ({saveFile, writeText} 만, options 생략) 가 SVG 모드로 동작', async () => {
    const root = document.createElement('div');
    const c = document.createElement('div');
    c.className = 'diagrade-mermaid';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
    svg.setAttribute('viewBox', '0 0 10 10');
    c.appendChild(svg);
    root.appendChild(c);
    document.body.replaceChildren(root);

    const saveFile = vi.fn().mockResolvedValue('/tmp/x-1.svg');
    const writeText = vi.fn().mockResolvedValue(undefined);
    const r = await saveAllDiagrams(root, '/x/x.md', { saveFile, writeText });
    expect(r).toEqual({ saved: 1, cancelledAt: null, noCharts: false });
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
