/**
 * Mermaid 11 lazy 초기화. FR-06/07/09.
 *
 * - import('mermaid') 는 dynamic — 번들이 별도 청크로 분리되어 첫 렌더 전엔 로드되지 않음.
 *   FR-09 (외부 CDN 의존 X): Vite 가 빌드 시 청크를 같이 출력하므로 런타임 네트워크 요청 없음.
 *
 * - securityLevel: 'strict' — 라벨의 <script> 와 위험한 markup 을 mermaid 자체가 차단.
 *   추가로 sanitizeMermaidSvg 가 출력에 한 번 더 적용됨 (defense-in-depth).
 *
 * - startOnLoad: false — DOMContentLoaded 자동 실행 비활성. 우리가 명시적으로 render 호출.
 */

type MermaidModule = typeof import('mermaid');
type MermaidApi = MermaidModule['default'];

let mermaidPromise: Promise<MermaidApi> | null = null;
let initialized = false;

async function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => mod.default);
  }
  return mermaidPromise;
}

export async function getMermaid(): Promise<MermaidApi> {
  const mermaid = await loadMermaid();
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default',
      fontFamily:
        'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence: { useMaxWidth: true },
      gantt: { useMaxWidth: true }
    });
    initialized = true;
  }
  return mermaid;
}

/** 테스트용 — 모듈 상태를 초기화. */
export const __testReset = () => {
  mermaidPromise = null;
  initialized = false;
};
