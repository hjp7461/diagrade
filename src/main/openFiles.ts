import { ipcMain } from 'electron';
import { extname, isAbsolute, resolve } from 'node:path';
import { IpcChannel } from '../shared/types';

/**
 * OS 파일 탐색기 연동 — Windows "연결 프로그램", macOS "다음으로 열기", Linux MimeType.
 * 등록 자체는 electron-builder.yml 의 fileAssociations 가 담당하고, 이 파일은 런타임 수신부.
 *
 * 경로가 앱에 도착하는 통로는 셋:
 *   ① 콜드 스타트 (Windows/Linux) — process.argv
 *   ② 이미 떠 있는 인스턴스 (Windows/Linux) — app 의 'second-instance' argv
 *   ③ macOS — app 의 'open-file' 이벤트. argv 를 쓰지 않으며 app.ready 이전에도 발생한다.
 *
 * ①/③ 은 렌더러가 onFilesOpened 구독을 시작하기 전에 도착할 수 있다. 그대로 send 하면
 * 유실되므로 (= 파일을 더블클릭했는데 빈 창) main 이 버퍼에 쌓아두고 렌더러가 mount 직후
 * app:take-pending-files 로 가져간다 (pull). 창이 이미 살아있는 ② 만 push 로 즉시 전달.
 */

const MD_EXTENSIONS = new Set(['.md', '.markdown']);

/**
 * argv 에서 마크다운 파일 경로만 추출. 순수 함수 — Electron 런타임 없이 단위 테스트.
 *
 * argv[0] 은 실행 파일이라 건너뛰고, dev/e2e 의 argv[1] (out/main/index.js) 은 확장자
 * 필터가 걸러낸다. `--flag` 형태 스위치도 제외. 상대 경로는 절대 경로로 정규화.
 */
export function markdownPathsFromArgv(argv: readonly string[]): string[] {
  return argv
    .slice(1)
    .filter((arg) => !arg.startsWith('-') && MD_EXTENSIONS.has(extname(arg).toLowerCase()))
    .map((arg) => (isAbsolute(arg) ? arg : resolve(arg)));
}

const pending: string[] = [];

export function addPendingFiles(paths: string[]): void {
  pending.push(...paths);
}

/**
 * 렌더러가 mount 직후 호출. 가져가면서 버퍼를 비운다 —
 * effect 가 재실행돼도 같은 파일이 중복으로 열리지 않는다.
 */
export function registerPendingFilesIpc(): void {
  ipcMain.handle(IpcChannel.AppTakePendingFiles, (): string[] => pending.splice(0));
}

/** 테스트용 — 버퍼 상태 검증. 프로덕션 코드에서는 사용하지 말 것. */
export const __test__ = {
  peek: (): string[] => [...pending],
  reset: (): void => {
    pending.length = 0;
  }
};
