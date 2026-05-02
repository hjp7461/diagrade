import { ipcMain } from 'electron';
import { IpcChannel, type Config } from '../../shared/types';
import type { ConfigStore } from '../config';

/**
 * onChange 콜백: PRD-002 FR-14 의 "런타임 config 변경 즉시 반영".
 * 예: liveReload 가 false 로 바뀌면 main 이 watcher 를 즉시 정지.
 */
export function registerConfigIpc(
  store: ConfigStore,
  onChange?: (cfg: Config) => void
): void {
  ipcMain.handle(IpcChannel.ConfigGet, (): Config => store.get());
  ipcMain.handle(IpcChannel.ConfigSet, (_event, partial: Partial<Config>): Config => {
    const updated = store.set(partial);
    onChange?.(updated);
    return updated;
  });
}
