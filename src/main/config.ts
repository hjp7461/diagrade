import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Config } from '../shared/types';

export type { Config };

/**
 * App 설정 저장소. PRD-001 §3.8.
 *
 * 구조 변경 규칙: 후속 PRD 에서 키를 추가할 때, 기존 키는 의미를 그대로 유지한다.
 * 사용자 설정 파일은 마이그레이션 없이 자연스럽게 새 키를 인식해야 한다 (validateConfig
 * 가 알 수 없는 키를 무시하고 누락 키를 기본값으로 채우기 때문에 forward-compat 자동).
 */

export const DEFAULT_CONFIG: Config = {
  maxTabs: 20
};

const MIN_MAX_TABS = 1;

/**
 * 임의의 unknown 입력을 받아 항상 유효한 Config 를 반환한다.
 * FR-40: 파싱 실패 / 누락 / 의미상 잘못된 값은 모두 기본값으로 폴백.
 *
 * 순수 함수이므로 단위 테스트가 직접 가능하다.
 */
export function validateConfig(raw: unknown): Config {
  const cfg: Config = { ...DEFAULT_CONFIG };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return cfg;
  const r = raw as Record<string, unknown>;

  const candidate = r['maxTabs'];
  if (
    typeof candidate === 'number' &&
    Number.isInteger(candidate) &&
    candidate >= MIN_MAX_TABS &&
    Number.isFinite(candidate)
  ) {
    cfg.maxTabs = candidate;
  }

  return cfg;
}

/**
 * 디스크-backed 설정 저장소.
 *
 * 생성 시 즉시 load (FR-38: 첫 실행이면 자동 생성). load 와 set 양쪽에서
 * validateConfig 를 거쳐 항상 유효한 캐시만 보유한다.
 */
export class ConfigStore {
  readonly filePath: string;
  private cached: Config;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.cached = this.load();
  }

  private load(): Config {
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      return validateConfig(JSON.parse(raw));
    } catch {
      // 파일 없음 / 권한 / JSON 깨짐 — 모두 기본값 + 디스크 복구.
      const fallback = { ...DEFAULT_CONFIG };
      this.persist(fallback);
      return fallback;
    }
  }

  private persist(cfg: Config): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(cfg, null, 2), 'utf-8');
  }

  get(): Config {
    // 외부에서 변경해도 캐시에 영향 없도록 복사본 반환.
    return { ...this.cached };
  }

  set(partial: Partial<Config>): Config {
    const merged = validateConfig({ ...this.cached, ...partial });
    this.cached = merged;
    this.persist(merged);
    return { ...merged };
  }
}
