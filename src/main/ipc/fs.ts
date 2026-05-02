import { ipcMain } from 'electron';
import { IpcChannel, type ReadTextResponse } from '../../shared/types';
import { listMarkdownFiles } from '../fs/listMd';
import { readMarkdownFile } from '../fs/readMarkdown';
import { writeTextFile } from '../fs/writeText';
import { writeBinaryFile } from '../fs/writeBinary';

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

  ipcMain.handle(
    IpcChannel.FsWriteText,
    (_event, payload: { path: string; content: string }): Promise<void> =>
      writeTextFile(payload.path, payload.content)
  );

  ipcMain.handle(
    IpcChannel.FsWriteBinary,
    (_event, payload: { path: string; base64: string }): Promise<void> =>
      writeBinaryFile(payload.path, payload.base64)
  );
}
