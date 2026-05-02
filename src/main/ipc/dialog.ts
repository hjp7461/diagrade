import { dialog, ipcMain, BrowserWindow } from 'electron';
import { IpcChannel, type SaveDialogFilter } from '../../shared/types';

const MARKDOWN_FILTER = { name: 'Markdown', extensions: ['md', 'markdown'] };

export function registerDialogIpc(): void {
  ipcMain.handle(
    IpcChannel.DialogOpenFile,
    async (event, payload: { multiple?: boolean }): Promise<string[]> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const properties: ('openFile' | 'multiSelections')[] = ['openFile'];
      if (payload.multiple) properties.push('multiSelections');

      const result = await (win
        ? dialog.showOpenDialog(win, { properties, filters: [MARKDOWN_FILTER] })
        : dialog.showOpenDialog({ properties, filters: [MARKDOWN_FILTER] }));

      return result.canceled ? [] : result.filePaths;
    }
  );

  ipcMain.handle(
    IpcChannel.DialogOpenFolder,
    async (event): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await (win
        ? dialog.showOpenDialog(win, { properties: ['openDirectory'] })
        : dialog.showOpenDialog({ properties: ['openDirectory'] }));

      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0]!;
    }
  );

  ipcMain.handle(
    IpcChannel.DialogSaveFile,
    async (
      event,
      payload: { defaultPath?: string; filters?: SaveDialogFilter[] }
    ): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const opts: Electron.SaveDialogOptions = {};
      if (payload.defaultPath) opts.defaultPath = payload.defaultPath;
      if (payload.filters) opts.filters = payload.filters;
      const result = await (win
        ? dialog.showSaveDialog(win, opts)
        : dialog.showSaveDialog(opts));
      return result.canceled || !result.filePath ? null : result.filePath;
    }
  );
}
