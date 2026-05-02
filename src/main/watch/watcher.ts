import chokidar, { type FSWatcher } from 'chokidar';
import { basename } from 'node:path';
import { isValidWatchPath, type WatchPathOptions } from './validation';

/**
 * 활성 탭 파일 watcher. PRD-002 §3.1, §6.4.
 *
 * - chokidar 의 atomic 옵션이 atomic save (write+rename) 를 단일 change 이벤트로 합쳐줌.
 *   atomic 시간 안에 unlink 후 add 가 오면 chokidar 가 unlink 이벤트를 emit 하지 않음.
 *   따라서 unlink 이 우리 콜백에 도달했다 = 진짜 삭제 (또는 grace 윈도우 초과).
 * - 디바운스는 chokidar 위에서 한 번 더 — 빠른 연속 저장 (format-on-save 등) 을 합침.
 * - 활성 탭 전환 시 setActivePath 가 stop + start 를 atomically 처리.
 */

export interface WatcherCallbacks {
  onChange: () => void;
  onMissing: (filename: string) => void;
}

export interface WatcherOptions {
  debounceMs?: number;
  atomicMs?: number;
  validation: WatchPathOptions;
}

const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_ATOMIC_MS = 300;

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private currentPath: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly callbacks: WatcherCallbacks,
    private readonly options: WatcherOptions
  ) {}

  setActivePath(path: string | null): void {
    if (path === this.currentPath) return;
    this.stop();
    if (!path) return;
    if (!isValidWatchPath(path, this.options.validation)) {
      // SEC-02: 조용히 무시. 잘못된 path 의 출처(코드 버그/공격) 를 알 수 없으므로 에러 X.
      return;
    }
    this.start(path);
  }

  private start(path: string): void {
    this.currentPath = path;
    this.watcher = chokidar.watch(path, {
      ignoreInitial: true,
      persistent: true,
      atomic: this.options.atomicMs ?? DEFAULT_ATOMIC_MS,
      ignorePermissionErrors: true,
      awaitWriteFinish: false
    });

    this.watcher.on('change', () => this.scheduleChange());
    this.watcher.on('add', () => this.scheduleChange());
    this.watcher.on('unlink', () => this.fireMissing());
    this.watcher.on('error', () => {
      // chokidar 가 자체 로그함. 우리는 swallow — watcher 가 죽어도 앱은 계속.
    });
  }

  private scheduleChange(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.callbacks.onChange();
    }, this.options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  }

  private fireMissing(): void {
    if (!this.currentPath) return;
    this.callbacks.onMissing(basename(this.currentPath));
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
    this.currentPath = null;
  }

  getCurrentPath(): string | null {
    return this.currentPath;
  }

  isWatching(): boolean {
    return this.watcher !== null;
  }
}
