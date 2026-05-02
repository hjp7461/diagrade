import { ipcMain, dialog, BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import { IpcChannel } from '../../shared/types';

/**
 * print:pdf — 활성 webContents 를 PDF 로 저장. FR-36, PRD §5.1.
 *
 * 절차:
 *   1) save 대화상자 (확장자 .pdf 필터)
 *   2) webContents.printToPDF() — print 미디어로 렌더되므로 @media print 가 적용되어
 *      FR-29/37 의 "export UI 안 박힘" 자동 처리
 *   3) Buffer 를 파일로 기록
 *
 * 반환: 저장 경로 또는 null (사용자 취소).
 */
export function registerPrintIpc(): void {
  ipcMain.handle(
    IpcChannel.PrintPdf,
    async (event, payload: { defaultPath?: string }): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const opts: Electron.SaveDialogOptions = {
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      };
      if (payload.defaultPath) opts.defaultPath = payload.defaultPath;

      const result = await (win
        ? dialog.showSaveDialog(win, opts)
        : dialog.showSaveDialog(opts));

      if (result.canceled || !result.filePath) return null;

      const buffer = await event.sender.printToPDF({
        printBackground: true,
        landscape: false
      });
      await writeFile(result.filePath, buffer);
      return result.filePath;
    }
  );
}
