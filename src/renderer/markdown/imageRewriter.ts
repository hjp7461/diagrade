/**
 * 마크다운 본문 안의 상대 경로 이미지를 diagrade-asset:// URL 로 변환한다.
 *
 * 입력: markdown-it 의 raw HTML (sanitize 전).
 * 출력: 같은 HTML, 단 img[src] 가 다음 규칙으로 치환됨:
 *   - 이미 절대 URL (http/https/data/file/diagrade-asset 등 *:* 형태) → 그대로
 *   - protocol-relative (`//foo.example/bar.png`) → 그대로 (외부 호스트)
 *   - anchor (`#foo`) → 그대로 (사용 사례 드물지만 보존)
 *   - 그 외 (상대 경로) → `diagrade-asset://<encoded-tabId>/<encoded-path>`
 *
 * tabId 와 path 모두 percent-encoding 처리해서 공백/특수문자가 URL 을 깨지 않도록 한다.
 *
 * sanitize 전에 실행하는 이유: DOMPurify 의 ALLOWED_URI_REGEXP 가 `diagrade-asset:` 로
 * 시작하는 src 를 허용하므로, 이쪽 변환이 끝난 후 sanitize 가 통과시킨다.
 */

const HAS_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:/i;

export function rewriteImageSrcs(html: string, tabId: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const encodedTabId = encodeURIComponent(tabId);

  doc.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src) return;
    if (HAS_PROTOCOL_RE.test(src)) return;
    if (src.startsWith('//')) return;
    if (src.startsWith('#')) return;

    const encodedRel = src
      .split('/')
      .map((seg) => (seg === '' || seg === '.' || seg === '..' ? seg : encodeURIComponent(seg)))
      .join('/');

    img.setAttribute('src', `diagrade-asset://${encodedTabId}/${encodedRel}`);
  });

  return doc.body.innerHTML;
}
