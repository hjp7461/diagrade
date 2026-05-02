#!/usr/bin/env node
/**
 * 기본 아이콘 생성 스크립트.
 *
 * 외부 의존성 없이 Node 표준 라이브러리(zlib) 만으로 1024×1024 솔리드 PNG 를 생성한다.
 * 첫 실행 시 / 의도적 재생성 시 호출. 사용자 정의 아이콘은 이 스크립트가 만든 결과를
 * 덮어쓰는 식으로 적용 (assets/icon.png 그대로 두면 됨).
 *
 * 사용:
 *   node scripts/generate-default-icon.mjs            # 기본 색상으로 생성
 *   node scripts/generate-default-icon.mjs --force    # 기존 파일이 있어도 덮어씀
 *
 * 디자인:
 *   - 1024×1024
 *   - 배경: #1f2937 (dark slate)
 *   - 중앙: 약 60% 크기의 둥근 사각형 "그라디언트 느낌" (실제론 단순 두 단계)
 *   - 안에 "D" 문자 윤곽 (픽셀 폰트로 직접 그려서 외부 폰트 의존 X)
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '..', 'assets', 'icon.png');
const WIDTH = 1024;
const HEIGHT = 1024;

// ──────────────────────────────────────────────────────────────────
// PNG encoder (pure-Node)
// ──────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function makePngRgba(width, height, pixels) {
  // Each row: 1 filter byte + width * 4 RGBA bytes.
  const stride = 1 + width * 4;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * stride + 1 + x * 4;
      raw[dstIdx] = pixels[srcIdx];
      raw[dstIdx + 1] = pixels[srcIdx + 1];
      raw[dstIdx + 2] = pixels[srcIdx + 2];
      raw[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type: RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ──────────────────────────────────────────────────────────────────
// 디자인 — 픽셀 단위 직접 그리기
// ──────────────────────────────────────────────────────────────────

const COLORS = {
  bg: [0x1f, 0x29, 0x37, 0xff], // dark slate
  tile: [0x2b, 0x6c, 0xb0, 0xff], // medium blue
  tileEdge: [0x3b, 0x82, 0xc6, 0xff], // lighter blue (edge highlight)
  letter: [0xff, 0xff, 0xff, 0xff] // white
};

function setPx(pixels, x, y, color) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = color[3];
}

function fillRect(pixels, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setPx(pixels, x, y, color);
  }
}

/** 둥근 사각형 (radius 픽셀 모서리 자르기 — 단순 마스크). */
function fillRoundedRect(pixels, x0, y0, w, h, radius, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const dx = x < x0 + radius ? x0 + radius - x : x >= x0 + w - radius ? x - (x0 + w - radius) + 1 : 0;
      const dy = y < y0 + radius ? y0 + radius - y : y >= y0 + h - radius ? y - (y0 + h - radius) + 1 : 0;
      if (dx * dx + dy * dy > radius * radius) continue;
      setPx(pixels, x, y, color);
    }
  }
}

/**
 * 문자 'D' 를 픽셀 단위로 그리기. 외부 폰트 의존 없이 단순 직선 + 호로.
 * 좌측 세로 막대 + 우측 반원 호.
 */
function drawLetterD(pixels, cx, cy, size, thickness, color) {
  const halfH = size / 2;
  const halfW = size * 0.42;
  const left = Math.round(cx - halfW);
  const top = Math.round(cy - halfH);
  const bottom = Math.round(cy + halfH);

  // 좌측 세로 막대.
  fillRect(pixels, left, top, thickness, bottom - top, color);

  // 우측 반원 호 (D 의 둥근 부분). 중심은 (cx - halfW + thickness, cy), 반지름 = halfH.
  const arcCx = cx - halfW + thickness;
  const arcRy = halfH;
  const arcRx = halfH * 1.15; // 살짝 wide
  for (let y = top; y <= bottom; y++) {
    for (let x = left + thickness; x <= cx + halfW; x++) {
      const ndx = (x - arcCx) / arcRx;
      const ndy = (y - cy) / arcRy;
      const r = ndx * ndx + ndy * ndy;
      const inner = ((arcRx - thickness) / arcRx) * ((arcRx - thickness) / arcRx);
      if (r <= 1 && r >= inner * 0.9 && x >= arcCx) setPx(pixels, x, y, color);
    }
  }
}

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────

function main() {
  const force = process.argv.includes('--force');

  if (existsSync(OUTPUT) && !force) {
    console.log(`이미 존재: ${OUTPUT} (덮어쓰려면 --force)`);
    return;
  }

  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);

  // 배경 (단색).
  fillRect(pixels, 0, 0, WIDTH, HEIGHT, COLORS.bg);

  // 중앙 둥근 타일.
  const tileSize = Math.round(WIDTH * 0.7);
  const tileX = Math.round((WIDTH - tileSize) / 2);
  const tileY = Math.round((HEIGHT - tileSize) / 2);
  const tileR = Math.round(tileSize * 0.18);
  fillRoundedRect(pixels, tileX, tileY, tileSize, tileSize, tileR, COLORS.tile);

  // "D" 문자.
  drawLetterD(
    pixels,
    Math.round(WIDTH / 2),
    Math.round(HEIGHT / 2),
    Math.round(tileSize * 0.55),
    Math.round(tileSize * 0.1),
    COLORS.letter
  );

  const png = makePngRgba(WIDTH, HEIGHT, pixels);

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, png);

  console.log(`생성 완료: ${OUTPUT} (${png.length.toLocaleString()} bytes)`);
}

main();
