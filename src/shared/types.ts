/**
 * IPC 경계를 가로지르는 타입.
 *
 * main · preload · renderer 가 모두 import 한다. 양쪽 tsconfig 의 `include`
 * 에 src/shared 가 들어가 있어 project references 로 동일 정의를 본다.
 *
 * 추가 규칙:
 *   - 여기에는 *값* 을 두지 않는다 (런타임 코드 X). 타입과 const literal 만.
 *   - DOM/Node 양쪽 환경에서 모두 컴파일 가능해야 한다.
 */

export interface Config {
  maxTabs: number;
  /** PRD-002 FR-11: 파일 디스크 변경 시 활성 탭 자동 갱신. default true. */
  liveReload: boolean;
}

export type MenuCommand =
  | 'close-tab'
  | 'next-tab'
  | 'prev-tab'
  | 'save-all-diagrams'
  | 'export-pdf'
  | 'open-search';

/** IPC 채널 이름. PRD-001 §5.1 + PRD-002 §5.1. */
export const IpcChannel = {
  DialogOpenFile: 'dialog:open-file',
  DialogOpenFolder: 'dialog:open-folder',
  DialogSaveFile: 'dialog:save-file',
  FsListMd: 'fs:list-md',
  FsReadText: 'fs:read-text',
  FsWriteText: 'fs:write-text',
  FsWriteBinary: 'fs:write-binary',
  ConfigGet: 'config:get',
  ConfigSet: 'config:set',
  ProtocolRegisterTabDir: 'protocol:register-tab-dir',
  ProtocolUnregisterTabDir: 'protocol:unregister-tab-dir',
  PrintPdf: 'print:pdf',
  // PRD-002: live reload
  WatchSetActivePath: 'watch:set-active-path',
  AppFileChanged: 'app:file-changed',
  AppFileMissing: 'app:file-missing',
  AppFilesOpened: 'app:files-opened',
  AppMenuCommand: 'app:menu-command'
} as const;

export interface SaveDialogFilter {
  name: string;
  extensions: string[];
}

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];

export interface ReadTextResponse {
  content: string;
  encoding: 'utf-8';
}
