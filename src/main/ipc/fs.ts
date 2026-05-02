import { ipcMain } from 'electron';
import { IpcChannel } from '../../shared/types';
import { listMarkdownFiles } from '../fs/listMd';

export function registerFsIpc(): void {
  ipcMain.handle(
    IpcChannel.FsListMd,
    (_event, payload: { folder: string }): Promise<string[]> => listMarkdownFiles(payload.folder)
  );
}
