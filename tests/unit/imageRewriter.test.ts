/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { rewriteImageSrcs } from '../../src/renderer/markdown/imageRewriter';

const TAB_ID = 'tab-1';

function srcOf(html: string): string | null {
  const m = html.match(/<img[^>]*src="([^"]*)"/);
  return m?.[1] ?? null;
}

describe('rewriteImageSrcs', () => {
  it('상대 경로는 diagrade-asset:// 로 치환', () => {
    const out = rewriteImageSrcs('<p><img src="./img.png" alt=""></p>', TAB_ID);
    expect(srcOf(out)).toBe('diagrade-asset://tab-1/./img.png');
  });

  it('서브디렉터리 상대 경로', () => {
    const out = rewriteImageSrcs('<p><img src="assets/sub/img.png"></p>', TAB_ID);
    expect(srcOf(out)).toBe('diagrade-asset://tab-1/assets/sub/img.png');
  });

  it('절대 http URL 은 그대로', () => {
    const html = '<p><img src="https://example.com/x.png"></p>';
    const out = rewriteImageSrcs(html, TAB_ID);
    expect(srcOf(out)).toBe('https://example.com/x.png');
  });

  it('data: URI 는 그대로', () => {
    const html = '<p><img src="data:image/png;base64,iVBOR"></p>';
    const out = rewriteImageSrcs(html, TAB_ID);
    expect(srcOf(out)).toBe('data:image/png;base64,iVBOR');
  });

  it('protocol-relative URL (//) 은 그대로 (외부 호스트 의도)', () => {
    const html = '<p><img src="//cdn.example/x.png"></p>';
    const out = rewriteImageSrcs(html, TAB_ID);
    expect(srcOf(out)).toBe('//cdn.example/x.png');
  });

  it('이미 diagrade-asset:// 인 src 는 그대로 (idempotent)', () => {
    const html = '<p><img src="diagrade-asset://other-tab/x.png"></p>';
    const out = rewriteImageSrcs(html, TAB_ID);
    expect(srcOf(out)).toBe('diagrade-asset://other-tab/x.png');
  });

  it('공백 포함 파일명은 percent-encoding', () => {
    const out = rewriteImageSrcs('<p><img src="my image.png"></p>', TAB_ID);
    expect(srcOf(out)).toBe('diagrade-asset://tab-1/my%20image.png');
  });

  it('한국어 파일명도 안전하게 인코딩', () => {
    const out = rewriteImageSrcs('<p><img src="한국어.png"></p>', TAB_ID);
    expect(srcOf(out)).toBe(`diagrade-asset://tab-1/${encodeURIComponent('한국어.png')}`);
  });

  it('tabId 도 인코딩 (콜론/슬래시가 있어도 URL 깨지지 않게)', () => {
    const out = rewriteImageSrcs('<p><img src="x.png"></p>', 'tab/with:colons');
    expect(srcOf(out)).toBe(`diagrade-asset://${encodeURIComponent('tab/with:colons')}/x.png`);
  });

  it('img 가 없으면 입력 그대로', () => {
    const html = '<p>본문</p>';
    expect(rewriteImageSrcs(html, TAB_ID)).toContain('<p>본문</p>');
  });
});
