import { writeFile } from 'node:fs/promises';

/**
 * base64-encoded binary 데이터를 파일로 저장. PNG 등 이진 산출물용.
 *
 * 입력 base64 는 dataURL prefix (`data:image/png;base64,`) 를 포함하면 안 된다 —
 * 호출자가 split 후 본문만 전달.
 */
export async function writeBinaryFile(path: string, base64: string): Promise<void> {
  const buf = Buffer.from(base64, 'base64');
  await writeFile(path, buf);
}
