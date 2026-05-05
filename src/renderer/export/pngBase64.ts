/**
 * PRD-016: PNG dataURL 본문(base64) 추출 + 검증.
 *
 * 호출자(`exportSingleChart`, `saveAllDiagrams`) 가 동일하게 사용하는 단일 출처.
 * 빈 / 비정상 dataURL 은 throw — 0 바이트 파일이 디스크에 닿지 않게 한다.
 *
 * `canvas.toDataURL('image/png')` 가 정상이면 항상 `data:image/png;base64,...` prefix 가
 * 붙는다. prefix 가 없거나 본문이 비어있으면 변환 실패로 간주.
 */
export function extractPngBase64(dataUrl: string): string {
  if (!dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('PNG 변환에 실패했습니다 (canvas.toDataURL 결과가 비정상).');
  }
  const body = dataUrl.slice('data:image/png;base64,'.length);
  if (body.length === 0) {
    throw new Error('PNG 변환에 실패했습니다 (변환 결과가 비어있음).');
  }
  return body;
}
