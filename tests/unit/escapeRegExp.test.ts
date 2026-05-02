import { describe, it, expect } from 'vitest';
import { escapeRegExp } from '../../src/renderer/search/escapeRegExp';

describe('escapeRegExp (PRD-003 SEC-01)', () => {
  it('일반 문자는 그대로', () => {
    expect(escapeRegExp('hello world')).toBe('hello world');
    expect(escapeRegExp('한국어')).toBe('한국어');
  });

  it('정규식 metachar 모두 escape', () => {
    expect(escapeRegExp('a.b')).toBe('a\\.b');
    expect(escapeRegExp('a*b')).toBe('a\\*b');
    expect(escapeRegExp('a+b')).toBe('a\\+b');
    expect(escapeRegExp('a?b')).toBe('a\\?b');
    expect(escapeRegExp('a^b$c')).toBe('a\\^b\\$c');
    expect(escapeRegExp('(group)')).toBe('\\(group\\)');
    expect(escapeRegExp('[chars]')).toBe('\\[chars\\]');
    expect(escapeRegExp('{n,m}')).toBe('\\{n,m\\}');
    expect(escapeRegExp('a|b')).toBe('a\\|b');
    expect(escapeRegExp('a\\b')).toBe('a\\\\b');
  });

  it('escape 결과는 RegExp 에 안전하게 사용 가능 (round-trip)', () => {
    const dangerous = '.*+?^${}()|[]\\';
    const escaped = escapeRegExp(dangerous);
    const re = new RegExp(escaped);
    // escape 된 패턴은 원본 문자열을 정확히 매칭해야 함
    expect(re.test(dangerous)).toBe(true);
  });

  it('빈 문자열', () => {
    expect(escapeRegExp('')).toBe('');
  });
});
