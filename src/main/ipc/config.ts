import { ipcMain } from 'electron';
import { IpcChannel, type Config } from '../../shared/types';
import type { ConfigStore } from '../config';

export function registerConfigIpc(store: ConfigStore): void {
  ipcMain.handle(IpcChannel.ConfigGet, (): Config => store.get());
  ipcMain.handle(IpcChannel.ConfigSet, (_event, partial: Partial<Config>): Config =>
    store.set(partial)
  );
}
