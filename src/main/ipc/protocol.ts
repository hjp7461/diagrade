import { ipcMain } from 'electron';
import { IpcChannel } from '../../shared/types';
import { registerTabDir, unregisterTabDir } from '../protocol';

export function registerProtocolIpc(): void {
  ipcMain.handle(
    IpcChannel.ProtocolRegisterTabDir,
    (_event, payload: { tabId: string; dir: string }): void => {
      registerTabDir(payload.tabId, payload.dir);
    }
  );

  ipcMain.handle(
    IpcChannel.ProtocolUnregisterTabDir,
    (_event, payload: { tabId: string }): void => {
      unregisterTabDir(payload.tabId);
    }
  );
}
