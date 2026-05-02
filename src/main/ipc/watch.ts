import { ipcMain } from 'electron';
import { IpcChannel } from '../../shared/types';
import type { FileWatcher } from '../watch/watcher';
import type { ConfigStore } from '../config';

/**
 * watch:set-active-path 핸들러. PRD-002 §5.1.
 *
 * config.liveReload 가 false 면 setActivePath(null) 로 안전하게 정지.
 * path 검증은 FileWatcher 내부의 isValidWatchPath 가 처리 (SEC-01).
 */
export function registerWatchIpc(watcher: FileWatcher, configStore: ConfigStore): void {
  ipcMain.handle(
    IpcChannel.WatchSetActivePath,
    (_event, payload: { path: string | null }): void => {
      const cfg = configStore.get();
      if (!cfg.liveReload) {
        watcher.setActivePath(null);
        return;
      }
      watcher.setActivePath(payload.path);
    }
  );
}
