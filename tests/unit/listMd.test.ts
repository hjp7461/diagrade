import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listMarkdownFiles } from '../../src/main/fs/listMd';

describe('listMarkdownFiles (FR-13)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-listmd-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('빈 폴더는 빈 배열', async () => {
    expect(await listMarkdownFiles(tmpDir)).toEqual([]);
  });

  it('.md / .markdown 만 포함, 그 외 확장자는 제외', async () => {
    writeFileSync(join(tmpDir, 'a.md'), '');
    writeFileSync(join(tmpDir, 'b.markdown'), '');
    writeFileSync(join(tmpDir, 'c.txt'), '');
    writeFileSync(join(tmpDir, 'd.png'), '');
    writeFileSync(join(tmpDir, 'noext'), '');

    const result = await listMarkdownFiles(tmpDir);
    expect(result).toHaveLength(2);
    expect(result.some((p) => p.endsWith('a.md'))).toBe(true);
    expect(result.some((p) => p.endsWith('b.markdown'))).toBe(true);
  });

  it('대소문자 무관 (.MD, .Markdown 모두 인식)', async () => {
    writeFileSync(join(tmpDir, 'A.MD'), '');
    writeFileSync(join(tmpDir, 'B.Markdown'), '');
    const result = await listMarkdownFiles(tmpDir);
    expect(result).toHaveLength(2);
  });

  it('FR-13: 재귀 X — 서브디렉터리의 .md 는 무시', async () => {
    writeFileSync(join(tmpDir, 'top.md'), '');
    mkdirSync(join(tmpDir, 'sub'));
    writeFileSync(join(tmpDir, 'sub', 'nested.md'), '');

    const result = await listMarkdownFiles(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.endsWith('top.md')).toBe(true);
  });

  it('서브디렉터리 이름이 .md 로 끝나도 디렉터리이므로 제외', async () => {
    mkdirSync(join(tmpDir, 'tricky.md'));
    writeFileSync(join(tmpDir, 'real.md'), '');

    const result = await listMarkdownFiles(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.endsWith('real.md')).toBe(true);
  });

  it('잘못된 경로 / 권한 실패 등은 빈 배열로 처리', async () => {
    expect(await listMarkdownFiles('/no/such/path/__diagrade_nonexistent__')).toEqual([]);
  });

  it('결과는 lexicographic 정렬', async () => {
    writeFileSync(join(tmpDir, 'z.md'), '');
    writeFileSync(join(tmpDir, 'a.md'), '');
    writeFileSync(join(tmpDir, 'm.md'), '');

    const result = await listMarkdownFiles(tmpDir);
    const names = result.map((p) => p.split(/[/\\]/).pop());
    expect(names).toEqual(['a.md', 'm.md', 'z.md']);
  });
});
