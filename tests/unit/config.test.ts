import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConfig, ConfigStore, DEFAULT_CONFIG } from '../../src/main/config';

describe('validateConfig (FR-40 robustness)', () => {
  it('null/undefined/array/primitive 입력은 모두 기본값 반환', () => {
    expect(validateConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(validateConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(validateConfig([])).toEqual(DEFAULT_CONFIG);
    expect(validateConfig(42)).toEqual(DEFAULT_CONFIG);
    expect(validateConfig('foo')).toEqual(DEFAULT_CONFIG);
    expect(validateConfig(true)).toEqual(DEFAULT_CONFIG);
  });

  it('빈 객체는 기본값 반환', () => {
    expect(validateConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it('FR-39: 유효한 maxTabs 는 적용된다', () => {
    expect(validateConfig({ maxTabs: 1 })).toEqual({ maxTabs: 1 });
    expect(validateConfig({ maxTabs: 50 })).toEqual({ maxTabs: 50 });
    expect(validateConfig({ maxTabs: 999 })).toEqual({ maxTabs: 999 });
  });

  it('FR-39: maxTabs 최소값 1 미만은 기본값으로 폴백', () => {
    expect(validateConfig({ maxTabs: 0 })).toEqual(DEFAULT_CONFIG);
    expect(validateConfig({ maxTabs: -1 })).toEqual(DEFAULT_CONFIG);
  });

  it('FR-40: 잘못된 타입 / 비정수 / 비유한값은 기본값으로 폴백', () => {
    expect(validateConfig({ maxTabs: '20' })).toEqual(DEFAULT_CONFIG);
    expect(validateConfig({ maxTabs: 1.5 })).toEqual(DEFAULT_CONFIG);
    expect(validateConfig({ maxTabs: Number.NaN })).toEqual(DEFAULT_CONFIG);
    expect(validateConfig({ maxTabs: Number.POSITIVE_INFINITY })).toEqual(DEFAULT_CONFIG);
    expect(validateConfig({ maxTabs: null })).toEqual(DEFAULT_CONFIG);
  });

  it('알 수 없는 키는 무시 (forward-compat: 새 키 추가 시 구버전이 깨지지 않음)', () => {
    expect(validateConfig({ maxTabs: 5, unknownKey: 'x' })).toEqual({ maxTabs: 5 });
  });
});

describe('ConfigStore (FR-38, FR-40, FR-41)', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-config-test-'));
    configPath = join(tmpDir, 'config.json');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('FR-38: 첫 실행 시 파일이 없으면 기본값으로 자동 생성', () => {
    expect(existsSync(configPath)).toBe(false);
    const store = new ConfigStore(configPath);
    expect(store.get()).toEqual(DEFAULT_CONFIG);
    expect(existsSync(configPath)).toBe(true);
    expect(JSON.parse(readFileSync(configPath, 'utf-8'))).toEqual(DEFAULT_CONFIG);
  });

  it('부모 디렉터리가 없어도 자동 생성', () => {
    const nestedPath = join(tmpDir, 'a', 'b', 'config.json');
    const store = new ConfigStore(nestedPath);
    expect(store.get()).toEqual(DEFAULT_CONFIG);
    expect(existsSync(nestedPath)).toBe(true);
  });

  it('FR-40: 깨진 JSON 은 기본값으로 복구하고 파일을 덮어쓴다', () => {
    writeFileSync(configPath, '{not json', 'utf-8');
    const store = new ConfigStore(configPath);
    expect(store.get()).toEqual(DEFAULT_CONFIG);
    expect(JSON.parse(readFileSync(configPath, 'utf-8'))).toEqual(DEFAULT_CONFIG);
  });

  it('FR-40: 의미상 잘못된 값을 가진 파일은 기본값으로 폴백', () => {
    writeFileSync(configPath, JSON.stringify({ maxTabs: -5 }), 'utf-8');
    const store = new ConfigStore(configPath);
    expect(store.get()).toEqual(DEFAULT_CONFIG);
  });

  it('유효한 파일은 그대로 로드', () => {
    writeFileSync(configPath, JSON.stringify({ maxTabs: 7 }), 'utf-8');
    const store = new ConfigStore(configPath);
    expect(store.get().maxTabs).toBe(7);
  });

  it('set 은 캐시와 디스크를 모두 갱신', () => {
    const store = new ConfigStore(configPath);
    const updated = store.set({ maxTabs: 5 });
    expect(updated.maxTabs).toBe(5);
    expect(store.get().maxTabs).toBe(5);
    expect(JSON.parse(readFileSync(configPath, 'utf-8')).maxTabs).toBe(5);
  });

  it('set 에 잘못된 값을 주면 validateConfig 가 보정', () => {
    const store = new ConfigStore(configPath);
    store.set({ maxTabs: 0 });
    expect(store.get()).toEqual(DEFAULT_CONFIG);
  });

  it('get 은 외부 변경에서 격리된 복사본을 반환 (불변성)', () => {
    const store = new ConfigStore(configPath);
    const cfg = store.get();
    cfg.maxTabs = 999;
    expect(store.get().maxTabs).toBe(DEFAULT_CONFIG.maxTabs);
  });
});
