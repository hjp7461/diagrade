import { contextBridge } from 'electron';

/**
 * window.diagrade 로 노출되는 IPC 진입점.
 *
 * M1: 채널 0 개 (보안/빌드 파이프라인 검증용 빈 객체).
 * M2~M6 에서 PRD §5.1 의 각 채널이 채워진다.
 */
const api = {
  version: '0.1.0'
} as const;

contextBridge.exposeInMainWorld('diagrade', api);

export type DiagradeApi = typeof api;
