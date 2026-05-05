import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeBinaryFile } from '../../src/main/fs/writeBinary';

describe('writeBinaryFile (PNG 등 base64 → bytes)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-writebin-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('PNG signature (89 50 4E 47 0D 0A 1A 0A) 보존', async () => {
    // 1×1 png pixel base64
    const base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const path = join(tmpDir, 'pixel.png');
    await writeBinaryFile(path, base64);
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  });

  it('임의 base64 → 정확한 바이트', async () => {
    const original = Buffer.from([0x00, 0xff, 0x42, 0x13, 0x37]);
    const base64 = original.toString('base64');
    const path = join(tmpDir, 'arbitrary.bin');
    await writeBinaryFile(path, base64);
    const bytes = readFileSync(path);
    expect(bytes.equals(original)).toBe(true);
  });

  it('PRD-016: 빈 base64 → throw, 파일 미생성', async () => {
    // 회귀 방지: 이전에는 0 바이트 파일이 침묵 생성되어 PNG 저장 실패가 사용자에게 안 보였다.
    const path = join(tmpDir, 'empty.bin');
    await expect(writeBinaryFile(path, '')).rejects.toThrow(/비어있습니다/);
    expect(() => readFileSync(path)).toThrow(); // ENOENT — 파일 자체가 없어야 함.
  });
});
