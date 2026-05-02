import { contextBridge, ipcRenderer, webUtils } from 'electron';
import {
  IpcChannel,
  type Config,
  type MenuCommand,
  type ReadTextResponse,
  type SaveDialogFilter
} from '../shared/types';

/**
 * window.diagrade.* 로 노출되는 좁은 IPC API.
 *
 * 원칙:
 *   1) 채널 이름은 src/shared/types.ts 의 IpcChannel 상수만 사용.
 *   2) 모든 invoke 는 단일 인자 객체 / 단일 결과로 통일.
 *   3) 이벤트 구독은 unsubscribe 함수를 반환 (React useEffect cleanup 호환).
 *   4) Node API 는 절대 노출하지 않는다 — webUtils.getPathForFile 는 예외(File→path 매핑만,
 *      Electron 32+ 의 sandboxed renderer 가 절대경로를 알 수 있는 유일한 공식 경로).
 */

const dialog = {
  openFile: (multiple = false): Promise<string[]> =>
    ipcRenderer.invoke(IpcChannel.DialogOpenFile, { multiple }),
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannel.DialogOpenFolder, {}),
  saveFile: (defaultPath: string, filters: SaveDialogFilter[]): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannel.DialogSaveFile, { defaultPath, filters })
} as const;

const fs = {
  listMd: (folder: string): Promise<string[]> =>
    ipcRenderer.invoke(IpcChannel.FsListMd, { folder }),
  readText: (path: string): Promise<ReadTextResponse> =>
    ipcRenderer.invoke(IpcChannel.FsReadText, { path }),
  writeText: (path: string, content: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannel.FsWriteText, { path, content }),
  writeBinary: (path: string, base64: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannel.FsWriteBinary, { path, base64 })
} as const;

const protocol = {
  registerTabDir: (tabId: string, dir: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannel.ProtocolRegisterTabDir, { tabId, dir }),
  unregisterTabDir: (tabId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannel.ProtocolUnregisterTabDir, { tabId })
} as const;

const config = {
  get: (): Promise<Config> => ipcRenderer.invoke(IpcChannel.ConfigGet, {}),
  set: (partial: Partial<Config>): Promise<Config> =>
    ipcRenderer.invoke(IpcChannel.ConfigSet, partial)
} as const;

const events = {
  onFilesOpened: (handler: (paths: string[]) => void): (() => void) => {
    const wrapped = (_e: unknown, paths: string[]) => handler(paths);
    ipcRenderer.on(IpcChannel.AppFilesOpened, wrapped);
    return () => {
      ipcRenderer.off(IpcChannel.AppFilesOpened, wrapped);
    };
  },
  onMenuCommand: (handler: (command: MenuCommand) => void): (() => void) => {
    const wrapped = (_e: unknown, command: MenuCommand) => handler(command);
    ipcRenderer.on(IpcChannel.AppMenuCommand, wrapped);
    return () => {
      ipcRenderer.off(IpcChannel.AppMenuCommand, wrapped);
    };
  }
} as const;

const platform = {
  /**
   * 드래그앤드롭으로 받은 File 의 절대경로 추출.
   * Electron 32+ 에서 sandboxed renderer 의 File.path 가 제거된 후
   * 공식 대체 경로. preload 만 호출 가능.
   */
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
} as const;

const print = {
  pdf: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannel.PrintPdf, { defaultPath })
} as const;

const api = {
  version: '0.1.0',
  dialog,
  fs,
  config,
  events,
  platform,
  protocol,
  print
} as const;

contextBridge.exposeInMainWorld('diagrade', api);

export type DiagradeApi = typeof api;
