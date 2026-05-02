import { ipcMain } from 'electron';
import { IpcChannel, type ReadTextResponse } from '../../shared/types';
import { listMarkdownFiles } from '../fs/listMd';
import { readMarkdownFile } from '../fs/readMarkdown';

export function registerFsIpc(): void {
  ipcMain.handle(
    IpcChannel.FsListMd,
    (_event, payload: { folder: string }): Promise<string[]> => listMarkdownFiles(payload.folder)
  );

  ipcMain.handle(
    IpcChannel.FsReadText,
    async (_event, payload: { path: string }): Promise<ReadTextResponse> => {
      const content = await readMarkdownFile(payload.path);
      return { content, encoding: 'utf-8' };
    }
  );
}
