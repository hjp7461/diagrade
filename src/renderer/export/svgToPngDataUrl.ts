import { ensureSvgNs } from './serializeSvg';
import { computePngDimensions } from './computePngDimensions';

/**
 * SVG → PNG dataURL. CLAUDE.md pitfall #4, FR-23/24, §6.3.
 *
 * 절차:
 *   1) viewBox 우선으로 base 크기 결정 (computePngDimensions).
 *   2) cloned SVG 에 명시 width/height 부여 — Image 의 natural size 확정.
 *   3) Blob URL 로 <img> 로드.
 *   4) canvas.width/height 를 base × scale 로 잡고, 흰 배경 + drawImage 로 명시 fit.
 *
 * **setTransform 보다 drawImage(img, 0, 0, canvas.width, canvas.height) 명시 fit 이 안전.**
 */
export async function svgToPngDataUrl(svg: SVGSVGElement, scale = 2): Promise<string> {
  const vb = svg.viewBox?.baseVal;
  const rect = svg.getBoundingClientRect();
  const dims = computePngDimensions(
    vb?.width ?? 0,
    vb?.height ?? 0,
    rect.width,
    rect.height,
    scale
  );

  const clone = ensureSvgNs(svg.cloneNode(true) as SVGSVGElement);
  clone.setAttribute('width', String(dims.baseWidth));
  clone.setAttribute('height', String(dims.baseHeight));

  const xml = new XMLSerializer().serializeToString(clone);
  // CSP 정합: blob: 은 본 앱의 img-src 가 미허용 — data URI 만 사용 (svgXmlToDataUrl 참조).
  const url = svgXmlToDataUrl(xml);

  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = dims.canvasWidth;
  canvas.height = dims.canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.fillStyle = '#ffffff'; // FR-24
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/**
 * SVG XML → data: URI. `<img src=>` 로 로드해 canvas 에 그리는 용도.
 *
 * `URL.createObjectURL(blob)` 의 `blob:` URL 은 본 앱의 CSP `img-src` 가 허용하지 않아
 * (`'self' diagrade-asset: data:`) `<img>` 로딩이 차단된다. data URI 는 이미 허용되어 있어
 * 권한 확장 없이 동일 효과를 달성. PRD-016 의 후속 fix (PR #17 머지 후 발견된 root cause).
 *
 * 회귀 주의: blob URL 로 되돌리지 말 것 — `.claude/rules/export-svg-png.md` 참조.
 */
export function svgXmlToDataUrl(xml: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${url}`));
    img.src = url;
  });
}
