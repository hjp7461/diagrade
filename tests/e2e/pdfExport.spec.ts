import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { ElectronApplication } from '@playwright/test';

/**
 * PR #25 (7d6ba41) 의 회귀 가드.
 *
 * 버그: PDF 내보내기(printToPDF)는 print 미디어로 재레이아웃되는데, 화면 스크롤을
 * 흡수하려 고정해둔 레이아웃(html/body `overflow:hidden`, 루트 div `height:100vh`,
 * `main` `overflow:auto`)이 그대로 남아 인쇄 영역이 viewport 높이로 한정 → 본문이
 * 잘려 "일부 페이지만" 저장됐다.
 *
 * 수정: theme.css 의 `@media print` 블록이 height/overflow/flex 제약을 해제해 본문이
 * 여러 페이지로 흐른다. 이 e2e 는 실제 export-pdf 메뉴 → IPC PrintPdf → printToPDF
 * 경로를 그대로 구동하여, 한 viewport 로는 절대 안 들어가는 긴 문서가 다중 페이지
 * PDF 로 저장되는지 검증한다. (수정 회귀 시 pageCount 가 1 로 떨어진다.)
 */

const MAIN_PATH = resolve(__dirname, '../../out/main/index.js');

let app: ElectronApplication;
let tmpDir: string;

test.beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-e2e-pdf-'));
  app = await electron.launch({ args: [MAIN_PATH] });
});

test.afterEach(async () => {
  await app.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

async function pushFiles(paths: string[]): Promise<void> {
  await app.evaluate(({ BrowserWindow }, payload) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('no window');
    win.webContents.send('app:files-opened', payload);
  }, paths);
}

async function sendMenuCommand(command: string): Promise<void> {
  await app.evaluate(({ BrowserWindow }, cmd) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('no window');
    win.webContents.send('app:menu-command', cmd);
  }, command);
}

/** dialog.showSaveDialog 를 main 에서 monkey-patch (pngExport.spec.ts 와 동일 패턴). */
async function stubSaveDialog(filePaths: string[]): Promise<void> {
  await app.evaluate(({ dialog }, paths) => {
    let i = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dialog as any).showSaveDialog = async () => {
      const next = paths[i++];
      if (next === undefined) return { canceled: true, filePath: undefined };
      return { canceled: false, filePath: next };
    };
  }, filePaths);
}

/** 여러 viewport 높이를 확실히 넘는 긴 문서 — 60개 섹션. */
function longMarkdown(): string {
  const lines: string[] = ['# 긴 문서 PDF 페이지네이션 검증', ''];
  for (let i = 1; i <= 60; i++) {
    lines.push(`## 섹션 ${i}`);
    lines.push('');
    lines.push(`섹션 ${i} 의 본문 문단입니다. 클리핑 회귀를 잡기 위한 채움 텍스트. `.repeat(4));
    lines.push('');
  }
  lines.push('## 마지막-섹션-끝 END_MARKER_SENTINEL');
  lines.push('');
  return lines.join('\n');
}

/** Chromium(Skia) PDF 의 페이지 dict(`/Type /Page`) 카운트. /Pages 는 제외. */
function countPdfPages(buf: Buffer): number {
  const matches = buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

test('PR #25 회귀: 긴 문서 export-pdf → viewport 를 넘어 다중 페이지로 저장', async () => {
  const mdFile = join(tmpDir, 'long.md');
  writeFileSync(mdFile, longMarkdown(), 'utf-8');
  const pdfTarget = join(tmpDir, 'long.pdf');

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  await stubSaveDialog([pdfTarget]);
  await pushFiles([mdFile]);

  // 본문 렌더 + 문서 끝까지 DOM 에 존재 확인.
  await expect(win.locator('.diagrade-markdown')).toBeVisible({ timeout: 10_000 });
  await expect(win.locator('text=END_MARKER_SENTINEL')).toBeAttached({ timeout: 10_000 });

  await sendMenuCommand('export-pdf');

  await expect.poll(() => existsSync(pdfTarget), { timeout: 15_000 }).toBe(true);

  const bytes = readFileSync(pdfTarget);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');

  // 60개 섹션은 한 viewport 로 절대 안 들어간다. 클리핑 회귀 시 ~1페이지로 떨어진다.
  const pages = countPdfPages(bytes);
  expect(pages).toBeGreaterThanOrEqual(5);
});
