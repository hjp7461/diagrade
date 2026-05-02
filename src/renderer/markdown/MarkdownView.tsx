import { useEffect, useRef, useState } from 'react';
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
 *   3) DOMPurify 통과 결과만 dangerouslySetInnerHTML 로 mount
 *   4) mount 후 mermaid → Shiki → export 메뉴 주입 (모두 비동기)
 *   5) save-all-diagrams / export-pdf 메뉴 명령 수신
 */
export function MarkdownView({ tab, onNotify }: MarkdownViewProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
