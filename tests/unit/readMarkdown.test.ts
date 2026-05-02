import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readMarkdownFile } from '../../src/main/fs/readMarkdown';

describe('readMarkdownFile (defense-in-depth for fs:read-text)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-readmd-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('정상 .md 파일 읽기', async () => {
    const path = join(tmpDir, 'note.md');
    writeFileSync(path, '# Hello\n\n본문', 'utf-8');
    expect(await readMarkdownFile(path)).toBe('# Hello\n\n본문');
  });

  it('.markdown 도 허용', async () => {
    const path = join(tmpDir, 'note.markdown');
    writeFileSync(path, 'x', 'utf-8');
    expect(await readMarkdownFile(path)).toBe('x');
  });

  it('대소문자 무관 (.MD)', async () => {
    const path = join(tmpDir, 'NOTE.MD');
    writeFileSync(path, 'y', 'utf-8');
    expect(await readMarkdownFile(path)).toBe('y');
  });

  it('.txt 같은 다른 확장자 거부 — 임의 파일 읽기 차단', async () => {
    const path = join(tmpDir, 'secret.txt');
    writeFileSync(path, 'should not leak', 'utf-8');
    await expect(readMarkdownFile(path)).rejects.toThrow(/Unsupported file extension/);
  });

  it('확장자 없는 파일 거부', async () => {
    const path = join(tmpDir, 'noext');
    writeFileSync(path, 'x', 'utf-8');
    await expect(readMarkdownFile(path)).rejects.toThrow(/Unsupported file extension/);
  });

  it('UTF-8 한국어 보존', async () => {
    const path = join(tmpDir, 'ko.md');
    writeFileSync(path, '한국어 본문 ✅', 'utf-8');
    expect(await readMarkdownFile(path)).toBe('한국어 본문 ✅');
  });
});
