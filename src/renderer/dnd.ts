import { basenameOfPath, isMarkdownPath } from './path';

export interface DropResolution {
  /** 열려야 할 마크다운 파일 절대경로들 (폴더는 listMd 결과로 펼쳐진 상태) */
  paths: string[];
  /** FR-11: 미지원 형식으로 거부된 파일명들 (notification 용) */
  unsupported: string[];
}

export interface DropApi {
  getPathForFile: (file: File) => string;
  listMd: (folder: string) => Promise<string[]>;
}

/**
 * 드래그앤드롭 이벤트를 분류해 마크다운 파일 경로 목록으로 변환.
 *
 * - 파일: .md / .markdown 만 통과 (FR-04 의 marker 와 동일 정책)
 * - 폴더: 1-depth 의 .md / .markdown 만 (FR-13)
 * - 그 외: unsupported 목록에 파일명만 기록
 *
 * 비동기인 이유: 폴더 드롭은 main 의 fs.listMd 호출이 필요.
 */
export async function resolveDrop(
  dataTransfer: DataTransfer | null,
  api: DropApi
): Promise<DropResolution> {
  if (!dataTransfer) return { paths: [], unsupported: [] };

  // dataTransfer.items 는 live 객체라 await 사이에 비워질 수 있다. 즉시 스냅샷.
  const snapshot: { path: string; isDir: boolean }[] = [];
  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry();
    const file = item.getAsFile();
    if (!file || !entry) continue;
    snapshot.push({ path: api.getPathForFile(file), isDir: entry.isDirectory });
  }

  const paths: string[] = [];
  const unsupported: string[] = [];

  for (const { path, isDir } of snapshot) {
    if (isDir) {
      const mdFiles = await api.listMd(path);
      paths.push(...mdFiles);
    } else if (isMarkdownPath(path)) {
      paths.push(path);
    } else {
      unsupported.push(basenameOfPath(path));
    }
  }

  return { paths, unsupported };
}
