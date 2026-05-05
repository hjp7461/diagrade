import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileWatcher } from '../../src/main/watch/watcher';

/**
 * chokidar 통합 테스트. 실 파일시스템 사용 — 타이밍 의존이라 timeout 넉넉히.
 * 핵심 검증:
 *   - setActivePath(null) → stop
 *   - 잘못된 path → no-op (silent)
 *   - 정상 path → start, change 이벤트 받음 (debounce 후)
 *   - unlink → onMissing
 */

const SHORT_DEBOUNCE = 50;
const SHORT_ATOMIC = 100;

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('FileWatcher (PRD-002 §3.1)', () => {
  let tmpDir: string;
  let onChange: Mock<() => void>;
  let onMissing: Mock<(filename: string) => void>;
  let watcher: FileWatcher;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-watcher-'));
    onChange = vi.fn();
    onMissing = vi.fn();
  });

  afterEach(() => {
    watcher?.stop();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('setActivePath(null) 또는 빈 호출은 watcher 미시작', () => {
    watcher = new FileWatcher(
      { onChange, onMissing },
      { validation: { allowedDirs: () => [tmpDir] } }
    );
    watcher.setActivePath(null);
    expect(watcher.isWatching()).toBe(false);
  });

  it('잘못된 path (확장자 X) 는 silent 거부 — watcher 미시작', () => {
    const file = join(tmpDir, 'note.txt');
    writeFileSync(file, 'x');
    watcher = new FileWatcher(
      { onChange, onMissing },
      { validation: { allowedDirs: () => [tmpDir] } }
    );
    watcher.setActivePath(file);
    expect(watcher.isWatching()).toBe(false);
  });

  it('정상 path 시작 + 같은 path 재호출은 noop', () => {
    const file = join(tmpDir, 'note.md');
    writeFileSync(file, '# 1');
    watcher = new FileWatcher(
      { onChange, onMissing },
      { validation: { allowedDirs: () => [tmpDir] } }
    );
    watcher.setActivePath(file);
    expect(watcher.isWatching()).toBe(true);
    expect(watcher.getCurrentPath()).toBe(file);

    // 같은 path 재호출은 stop+start 안 함
    watcher.setActivePath(file);
    expect(watcher.isWatching()).toBe(true);
  });

  it('setActivePath(null) 로 stop', () => {
    const file = join(tmpDir, 'a.md');
    writeFileSync(file, '# x');
    watcher = new FileWatcher(
      { onChange, onMissing },
      { validation: { allowedDirs: () => [tmpDir] } }
    );
    watcher.setActivePath(file);
    expect(watcher.isWatching()).toBe(true);
    watcher.setActivePath(null);
    expect(watcher.isWatching()).toBe(false);
    expect(watcher.getCurrentPath()).toBeNull();
  });

  it('파일 변경 감지 → onChange 호출 (debounce 후)', async () => {
    const file = join(tmpDir, 'note.md');
    writeFileSync(file, '# initial');
    watcher = new FileWatcher(
      { onChange, onMissing },
      {
        debounceMs: SHORT_DEBOUNCE,
        atomicMs: SHORT_ATOMIC,
        validation: { allowedDirs: () => [tmpDir] }
      }
    );
    watcher.setActivePath(file);

    // chokidar 가 watch 셋업 완료까지 대기
    await wait(200);

    writeFileSync(file, '# modified');
    // debounce + atomic 합쳐 충분히 대기
    await wait(SHORT_DEBOUNCE + SHORT_ATOMIC + 200);

    expect(onChange).toHaveBeenCalled();
    expect(onMissing).not.toHaveBeenCalled();
  });

  it('파일 삭제 → onMissing 호출 (basename 전달)', async () => {
    const file = join(tmpDir, 'will-delete.md');
    writeFileSync(file, '# x');
    watcher = new FileWatcher(
      { onChange, onMissing },
      {
        debounceMs: SHORT_DEBOUNCE,
        atomicMs: SHORT_ATOMIC,
        validation: { allowedDirs: () => [tmpDir] }
      }
    );
    watcher.setActivePath(file);
    await wait(200);

    unlinkSync(file);
    // atomic grace + 약간의 여유
    await wait(SHORT_ATOMIC + 200);

    expect(onMissing).toHaveBeenCalledWith('will-delete.md');
  });

  it('빠른 연속 변경 → debounce 로 onChange 가 N 번 < 호출 횟수', async () => {
    const file = join(tmpDir, 'note.md');
    writeFileSync(file, 'v0');
    watcher = new FileWatcher(
      { onChange, onMissing },
      {
        debounceMs: SHORT_DEBOUNCE,
        atomicMs: SHORT_ATOMIC,
        validation: { allowedDirs: () => [tmpDir] }
      }
    );
    watcher.setActivePath(file);
    await wait(200);

    // 3 번 빠르게 쓰기
    writeFileSync(file, 'v1');
    writeFileSync(file, 'v2');
    writeFileSync(file, 'v3');

    await wait(SHORT_DEBOUNCE + SHORT_ATOMIC + 200);

    // 디바운스 덕에 N < 3
    expect(onChange.mock.calls.length).toBeLessThan(3);
    expect(onChange).toHaveBeenCalled();
  }, 10000);
});
