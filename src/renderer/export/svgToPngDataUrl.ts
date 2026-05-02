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
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
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
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${url}`));
    img.src = url;
  });
}
