import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeTextFile } from '../../src/main/fs/writeText';

describe('writeTextFile (FR-26 / §6.2: BOM 미기록)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-writetext-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('빈 문자열 — 첫 3 바이트가 EF BB BF (BOM) 가 아님', async () => {
    const path = join(tmpDir, 'empty.svg');
    await writeTextFile(path, '');
    const bytes = readFileSync(path);
    expect(bytes.length).toBe(0);
  });

  it('일반 ASCII — BOM 없음', async () => {
    const path = join(tmpDir, 'ascii.svg');
    await writeTextFile(path, '<svg></svg>');
    const bytes = readFileSync(path);
    expect(bytes[0]).toBe(0x3c); // '<'
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
  });

  it('UTF-8 다바이트 한국어 — BOM 없음', async () => {
    const path = join(tmpDir, 'ko.svg');
    await writeTextFile(path, '<svg>한국어</svg>');
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
    // 본문 내용은 보존
    expect(bytes.toString('utf-8')).toBe('<svg>한국어</svg>');
  });

  it('mermaid foreignObject 류의 SVG 문자열 — strict XML 파서 호환을 깨지 않음', async () => {
    const path = join(tmpDir, 'mermaid.svg');
    const xml =
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><foreignObject><br/></foreignObject></svg>';
    await writeTextFile(path, xml);
    const bytes = readFileSync(path);
    expect(bytes.toString('utf-8')).toBe(xml);
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
  });
});
