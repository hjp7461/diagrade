import { describe, it, expect } from 'vitest';
import { computeEffectiveTheme } from '../../src/renderer/theme/computeEffectiveTheme';

describe('computeEffectiveTheme (PRD-004 FR-02/03)', () => {
  it("setting 'auto' + 시스템 light → light", () => {
    expect(computeEffectiveTheme('auto', false)).toBe('light');
  });

  it("setting 'auto' + 시스템 dark → dark", () => {
    expect(computeEffectiveTheme('auto', true)).toBe('dark');
  });

  it("setting 'light' 강제 → 시스템 무시 light", () => {
    expect(computeEffectiveTheme('light', true)).toBe('light');
    expect(computeEffectiveTheme('light', false)).toBe('light');
  });

  it("setting 'dark' 강제 → 시스템 무시 dark", () => {
    expect(computeEffectiveTheme('dark', false)).toBe('dark');
    expect(computeEffectiveTheme('dark', true)).toBe('dark');
  });
});
