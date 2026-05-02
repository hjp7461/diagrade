import { describe, it, expect } from 'vitest';
import { computePngDimensions } from '../../src/renderer/export/computePngDimensions';

describe('computePngDimensions (CLAUDE.md pitfall #4, §6.3)', () => {
  it('viewBox 가 양수면 그것을 base 로 사용 (FR-23: scale × viewBox)', () => {
    const d = computePngDimensions(800, 600, 200, 150, 2);
    expect(d.baseWidth).toBe(800);
    expect(d.baseHeight).toBe(600);
    expect(d.canvasWidth).toBe(1600);
    expect(d.canvasHeight).toBe(1200);
  });

  it('viewBox 가 0/누락이면 boundingClientRect 로 폴백', () => {
    const d = computePngDimensions(0, 0, 400, 300, 2);
    expect(d.baseWidth).toBe(400);
    expect(d.baseHeight).toBe(300);
    expect(d.canvasWidth).toBe(800);
    expect(d.canvasHeight).toBe(600);
  });

  it('viewBox 의 한 축만 양수면 (희귀) 둘 다 fallback 으로 (보수적)', () => {
    const d = computePngDimensions(800, 0, 200, 150, 2);
    // useViewBox 가 false 이므로 fallback 둘 다 사용
    expect(d.baseWidth).toBe(200);
    expect(d.baseHeight).toBe(150);
  });

  it('소수점 viewBox 는 round', () => {
    const d = computePngDimensions(123.4, 78.6, 0, 0, 2);
    expect(d.baseWidth).toBe(123);
    expect(d.baseHeight).toBe(79);
  });

  it('모든 입력이 0/음수여도 최소 1×1 보장 (canvas 0 크기 방지)', () => {
    const d = computePngDimensions(0, 0, 0, 0, 2);
    expect(d.baseWidth).toBe(1);
    expect(d.baseHeight).toBe(1);
    expect(d.canvasWidth).toBe(2);
    expect(d.canvasHeight).toBe(2);
  });

  it('음수 fallback 은 0 으로 보정 (Math.max(0, ...)) 후 round', () => {
    const d = computePngDimensions(0, 0, -10, -5, 2);
    expect(d.baseWidth).toBe(1);
    expect(d.baseHeight).toBe(1);
  });

  it('scale = 1 로 1:1 추출도 가능 (향후 옵션화 대비)', () => {
    const d = computePngDimensions(500, 400, 0, 0, 1);
    expect(d.canvasWidth).toBe(500);
    expect(d.canvasHeight).toBe(400);
  });
});
