import { writeFile } from 'node:fs/promises';

/**
 * base64-encoded binary 데이터를 파일로 저장. PNG 등 이진 산출물용.
 *
 * 입력 base64 는 dataURL prefix (`data:image/png;base64,`) 를 포함하면 안 된다 —
 * 호출자가 split 후 본문만 전달.
 *
 * PRD-016: 빈 base64 입력은 0 바이트 파일을 침묵 생성하던 회귀의 한 축이었다.
 * 이 단계에서 명시 throw 하여 디스크에 닿지 않도록 방어 (defense in depth — renderer 에서도
 * extractPngBase64 가 1차로 막지만, IPC 경계 너머에서도 자체 방어).
 */
export async function writeBinaryFile(path: string, base64: string): Promise<void> {
  if (base64.length === 0) {
    throw new Error('writeBinaryFile: base64 가 비어있습니다 (PNG 변환 실패 가능).');
  }
  const buf = Buffer.from(base64, 'base64');
  await writeFile(path, buf);
}
