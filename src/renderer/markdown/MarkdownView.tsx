import { useEffect, useRef, useState } from 'react';
import type { Tab } from '../tabs/state';
import { renderMarkdown } from './render';
import { applyHighlight } from './highlight';
import { renderMermaidBlocks } from '../mermaid/render';

interface MarkdownViewProps {
  tab: Tab;
}

/**
 * 활성 탭의 마크다운 본문을 표시.
 *
 * 흐름:
 *   1) fs.readText 로 파일 내용 로드
 *   2) renderMarkdown (markdown-it → 이미지 src 치환 → DOMPurify) — 동기
 *   3) DOMPurify 통과 결과만 dangerouslySetInnerHTML 로 mount
 *      (React 의 공식 escape hatch. renderMarkdown 의 마지막 단계가 항상 sanitize.)
 *   4) mount 후 applyHighlight (Shiki, lazy import) — 비동기, 실패 시 평문 유지
 */
export function MarkdownView({ tab }: MarkdownViewProps) {
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
      // Mermaid 가 .language-mermaid 를 SVG 로 교체. 그 후 Shiki 가 남은 코드 블록 처리.
      await renderMermaidBlocks(container);
      if (cancelled) return;
      await applyHighlight(container);
    })();
    return () => {
      cancelled = true;
    };
  }, [html]);

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
