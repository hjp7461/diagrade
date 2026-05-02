import { writeFile } from 'node:fs/promises';

/**
 * UTF-8 텍스트 파일 쓰기. FR-26 / §6.2.
 *
 * Node 의 writeFile 은 'utf-8' 인코딩에서 BOM 을 추가하지 않는다. 그러나 stream 기반
 * 다른 경로로 쓸 때 BOM 이 섞일 가능성이 있어, 모든 SVG/text 출력은 이 헬퍼만 사용.
 *
 * **회귀 방지 검증**: 결과 파일의 첫 3 바이트가 `EF BB BF` 가 아닌지 단위 테스트로 확인.
 */
export async function writeTextFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, 'utf-8');
}
