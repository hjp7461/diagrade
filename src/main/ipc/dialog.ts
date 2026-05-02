import { dialog, ipcMain, BrowserWindow } from 'electron';
import { IpcChannel } from '../../shared/types';

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
}
