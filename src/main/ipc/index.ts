import { BrowserWindow } from 'electron';
import { registerDialogIpc } from './dialog';
import { registerFsIpc } from './fs';
import { registerConfigIpc } from './config';
import { registerProtocolIpc } from './protocol';
import { registerPrintIpc } from './print';
import { registerWatchIpc } from './watch';
import type { ConfigStore } from '../config';
import { FileWatcher } from '../watch/watcher';
import { getRegisteredTabDirs } from '../protocol';
import { IpcChannel } from '../../shared/types';

/**
 * 모든 IPC 핸들러 + FileWatcher 라이프사이클 관리.
 *
 * FileWatcher 의 콜백은 활성 webContents 로 app:file-changed / app:file-missing 을 push.
 * 활성 webContents 는 호출 시점에 lookup (창이 닫히거나 새 창이 떠도 자동 추적).
 */
export function registerAllIpc(store: ConfigStore): { watcher: FileWatcher } {
  function targetWebContents(): Electron.WebContents | null {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    return win ? win.webContents : null;
  }

  const watcher = new FileWatcher(
    {
      onChange: () => {
        const wc = targetWebContents();
        if (wc) wc.send(IpcChannel.AppFileChanged);
      },
      onMissing: (filename) => {
        const wc = targetWebContents();
        if (wc) wc.send(IpcChannel.AppFileMissing, { filename });
      }
    },
    {
      validation: { allowedDirs: () => getRegisteredTabDirs() }
    }
  );

  registerDialogIpc();
  registerFsIpc();
  registerConfigIpc(store, (cfg) => {
    // FR-14: liveReload 즉시 반영. false 가 되면 watcher 정지.
    if (!cfg.liveReload) watcher.setActivePath(null);
  });
  registerProtocolIpc();
  registerPrintIpc();
  registerWatchIpc(watcher, store);

  return { watcher };
}
