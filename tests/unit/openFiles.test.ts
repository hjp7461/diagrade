import { describe, it, expect, beforeEach } from 'vitest';
import { resolve } from 'node:path';
import { markdownPathsFromArgv, addPendingFiles, __test__ } from '../../src/main/openFiles';

/**
 * OS 파일 연결 (탐색기 우클릭 → 연결 프로그램) 의 argv 파싱.
 *
 * 회귀 시 시나리오: 확장자 필터를 빼면 dev/e2e 의 argv[1] (out/main/index.js) 이나
 * Chromium 스위치가 파일 경로로 오인되어 존재하지 않는 탭이 열린다.
 */
describe('markdownPathsFromArgv', () => {
  it('실행 파일(argv[0]) 은 항상 건너뛴다', () => {
    expect(markdownPathsFromArgv(['/apps/Diagrade.exe'])).toEqual([]);
  });

  it('.md / .markdown 만 추출', () => {
    const argv = ['diagrade.exe', '/docs/a.md', '/docs/b.markdown', '/docs/c.txt', '/docs/d.png'];
    // 이미 절대 경로면 원본 그대로 (재작성하지 않는다).
    expect(markdownPathsFromArgv(argv)).toEqual(['/docs/a.md', '/docs/b.markdown']);
  });

  it('확장자 대소문자를 가리지 않는다 (Windows 탐색기)', () => {
    expect(markdownPathsFromArgv(['x', '/docs/README.MD'])).toEqual(['/docs/README.MD']);
  });

  it('dev / e2e 의 진입 스크립트는 걸러진다', () => {
    expect(markdownPathsFromArgv(['electron', 'out/main/index.js'])).toEqual([]);
  });

  it('스위치(-, --) 는 제외', () => {
    const argv = ['electron', '--no-sandbox', '--enable-logging=x.md', '/docs/real.md'];
    expect(markdownPathsFromArgv(argv)).toEqual(['/docs/real.md']);
  });

  it('상대 경로는 절대 경로로 정규화', () => {
    const [only] = markdownPathsFromArgv(['electron', 'note.md']);
    expect(only).toBe(resolve('note.md'));
  });

  it('파일 인자가 없으면 빈 배열', () => {
    expect(markdownPathsFromArgv(['electron'])).toEqual([]);
    expect(markdownPathsFromArgv([])).toEqual([]);
  });
});

/**
 * 콜드 스타트 버퍼. 렌더러가 구독을 시작하기 전에 도착한 경로를 잃지 않되,
 * 한 번 가져가면 비워져야 한다 (effect 재실행 시 중복 오픈 방지).
 */
describe('pending 버퍼', () => {
  beforeEach(() => __test__.reset());

  it('쌓은 순서대로 보관', () => {
    addPendingFiles(['/a.md']);
    addPendingFiles(['/b.md', '/c.md']);
    expect(__test__.peek()).toEqual(['/a.md', '/b.md', '/c.md']);
  });

  it('빈 배열 추가는 무해', () => {
    addPendingFiles([]);
    expect(__test__.peek()).toEqual([]);
  });
});
