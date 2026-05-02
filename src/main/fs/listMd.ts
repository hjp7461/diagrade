import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const MD_EXTENSIONS = new Set(['.md', '.markdown']);

/**
 * FR-13: 폴더의 1-depth 내 .md / .markdown 파일 절대경로 목록.
 *
 * - 재귀 X
 * - 디렉터리는 제외 (서브디렉터리 이름이 .md 로 끝나도 제외)
 * - 대소문자 구분 X (확장자만)
 * - 정렬: lexicographic (sort()), OS-independent
 * - 권한 / 잘못된 경로 등 모든 실패는 빈 배열 (Renderer 가 일관된 빈 리스트 처리)
 */
export async function listMarkdownFiles(folder: string): Promise<string[]> {
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && MD_EXTENSIONS.has(extname(e.name).toLowerCase()))
      .map((e) => join(folder, e.name))
      .sort();
  } catch {
    return [];
  }
}
