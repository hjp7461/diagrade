import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const MD_EXTENSIONS = new Set(['.md', '.markdown']);

/**
 * Markdown 파일 본문을 UTF-8 로 읽는다.
 *
 * 보안 가드: 확장자가 .md / .markdown 이 아닌 파일은 거부.
 * 이는 fs:read-text IPC 가 임의 파일 (예: /etc/passwd) 을 읽어 노출하는 것을
 * 정책 단계에서 막는 defense-in-depth. DOMPurify 우회 + 임의 IPC 호출 시나리오에 대한 안전망.
 */
export async function readMarkdownFile(path: string): Promise<string> {
  const ext = extname(path).toLowerCase();
  if (!MD_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file extension: ${ext || '(none)'}`);
  }
  return readFile(path, 'utf-8');
}
