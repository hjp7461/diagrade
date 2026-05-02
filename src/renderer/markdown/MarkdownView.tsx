import { useEffect, useRef, useState, useCallback } from 'react';
import type { Tab } from '../tabs/state';
import { renderMarkdown } from './render';
import { applyHighlight } from './highlight';
import { renderMermaidBlocks } from '../mermaid/render';
import { injectExportMenus } from '../export/menu';
import { saveAllDiagrams } from '../export/saveAllDiagrams';
import { suggestedPdfFileName } from '../export/suggestedFilename';
import { basenameOfPath } from '../path';

interface MarkdownViewProps {
  tab: Tab;
  onNotify: (message: string) => void;
}

/**
 * 활성 탭의 마크다운 본문을 표시.
 *
 * 흐름:
 *   1) fs.readText 로 파일 내용 로드
 *   2) renderMarkdown (markdown-it → 이미지 src 치환 → DOMPurify) — 동기
 *   3) DOMPurify 통과 결과만 mount (React 의 공식 escape hatch)
 *   4) mount 후 mermaid → Shiki → export 메뉴 주입 (모두 비동기)
 *   5) save-all-diagrams / export-pdf 메뉴 명령 수신
 *   6) PRD-002: app:file-changed 수신 → reload + scrollTop 보존
 *   7) PRD-002: app:file-missing 수신 → 토스트
 */
export function MarkdownView({ tab, onNotify }: MarkdownViewProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // PRD-002 FR-04: 자동 갱신 시 scrollTop 보존을 위해 reload 직전 위치를 ref 에 저장.
  // mermaid/highlight 후처리가 끝난 다음 복원.
  const pendingScrollTopRef = useRef<number | null>(null);

  const loadFile = useCallback(() => {
    let cancelled = false;
    setError(null);

    window.diagrade.fs
      .readText(tab.filePath)
      .then(({ content }) => {
        if (cancelled) return;
        setHtml(renderMarkdown(content, tab.id));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [tab.filePath, tab.id]);

  // 초기 로드 + 탭 변경 시 reload.
  useEffect(() => loadFile(), [loadFile]);

  // 주의: watch.setActivePath 는 App 의 effect 가 담당 (registerTabDir 와 같은 effect 안에서
  // 순서 보장). 여기서 부르면 children-effect-first 순서 때문에 검증 race 가 생김.

  // PRD-002: 파일 변경 / 삭제 이벤트 수신.
  useEffect(() => {
    const offChanged = window.diagrade.events.onFileChanged(() => {
      // FR-04: scrollTop 캡처 후 reload 트리거.
      const main = containerRef.current?.parentElement;
      pendingScrollTopRef.current = main?.scrollTop ?? null;
      loadFile();
    });
    const offMissing = window.diagrade.events.onFileMissing((filename) => {
      // FR-08: 본문 유지 + 토스트 1 회.
      onNotify(`파일이 삭제되었습니다: ${filename}`);
    });
    return () => {
      offChanged();
      offMissing();
    };
  }, [loadFile, onNotify]);

  // mermaid / highlight / export 메뉴 + scrollTop 복원.
  useEffect(() => {
    if (!html || !containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;
    void (async () => {
      await renderMermaidBlocks(container);
      if (cancelled) return;
      await applyHighlight(container);
      if (cancelled) return;
      injectExportMenus(container, { activeTabPath: tab.filePath });

      // PRD-002 FR-04: 후처리 완료 후 scrollTop 복원 (reload 의 경우만 — pending null 이면 no-op).
      if (pendingScrollTopRef.current !== null) {
        const main = container.parentElement;
        if (main) main.scrollTop = pendingScrollTopRef.current;
        pendingScrollTopRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [html, tab.filePath]);

  // M6: 일괄 저장 + PDF 내보내기 메뉴 명령 수신.
  useEffect(() => {
    return window.diagrade.events.onMenuCommand(async (command) => {
      if (command === 'save-all-diagrams') {
        const container = containerRef.current;
        if (!container) return;
        const result = await saveAllDiagrams(container, tab.filePath, {
          saveFile: window.diagrade.dialog.saveFile,
          writeText: window.diagrade.fs.writeText
        });
        if (result.noCharts) {
          onNotify('이 문서에는 다이어그램이 없습니다.');
        } else if (result.cancelledAt !== null) {
          onNotify(`${result.saved} 개 저장 후 취소되었습니다.`);
        } else {
          onNotify(`다이어그램 ${result.saved} 개를 저장했습니다.`);
        }
      } else if (command === 'export-pdf') {
        try {
          const path = await window.diagrade.print.pdf(suggestedPdfFileName(tab.filePath));
          if (path) onNotify(`PDF 저장됨: ${basenameOfPath(path)}`);
        } catch (e) {
          onNotify(`PDF 저장 실패: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    });
  }, [tab.filePath, onNotify]);

  if (error) {
    return (
      <div style={errorStyle} role="alert">
        <strong>파일을 읽을 수 없습니다:</strong> {error}
      </div>
    );
  }

  return (
    <article
      ref={containerRef}
      className="diagrade-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
      style={contentStyle}
    />
  );
}

const errorStyle: React.CSSProperties = {
  padding: 16,
  color: '#c53030',
  background: '#fff5f5',
  border: '1px solid #fed7d7',
  borderRadius: 4
};

const contentStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  lineHeight: 1.6,
  color: '#222'
};
