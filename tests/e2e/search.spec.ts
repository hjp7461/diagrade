import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';

const MAIN_PATH = resolve(__dirname, '../../out/main/index.js');

let app: ElectronApplication;
let win: Page;
let tmpDir: string;
let userDataDir: string;

async function pushFiles(app: ElectronApplication, paths: string[]): Promise<void> {
  await app.evaluate(async ({ BrowserWindow }, payload) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (!w) throw new Error('no window');
    w.webContents.send('app:files-opened', payload);
  }, paths);
}

async function openSearch(app: ElectronApplication): Promise<void> {
  // 메뉴 가속기 시뮬 — 'open-search' MenuCommand 직접 발사.
  await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (!w) throw new Error('no window');
    w.webContents.send('app:menu-command', 'open-search');
  });
}

test.beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'diagrade-e2e-search-'));
  userDataDir = mkdtempSync(join(tmpdir(), 'diagrade-e2e-userdata-'));
  app = await electron.launch({
    args: [MAIN_PATH],
    env: { ...process.env, DIAGRADE_USER_DATA: userDataDir }
  });
  win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
});

test.afterEach(async () => {
  await app.close();
  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(userDataDir, { recursive: true, force: true });
});

test('FR-01: open-search 명령 → 검색바 표시 + 입력란 focus', async () => {
  const file = join(tmpDir, 'note.md');
  writeFileSync(file, '# 헤딩\n\n본문\n', 'utf-8');
  await pushFiles(app, [file]);

  await openSearch(app);

  await expect(win.locator('.diagrade-search-bar')).toBeVisible();
  // 입력란이 포커스되어 있는지 — 활성 element 확인
  const focused = await win.evaluate(
    () => document.activeElement?.classList.contains('diagrade-search-bar__input') ?? false
  );
  expect(focused).toBe(true);
});

test('FR-06/15/18: 검색어 입력 → 디바운스 후 매칭 + 카운터', async () => {
  const file = join(tmpDir, 'note.md');
  writeFileSync(
    file,
    '# foo\n\nfoo bar foo baz foo\n\n## 다른 헤딩\n\nfoo qux\n',
    'utf-8'
  );
  await pushFiles(app, [file]);
  await openSearch(app);

  // 'foo' 입력 — 본문에 5 개 (헤딩 1 + 본문 3 + 다음 단락 1).
  await win.locator('.diagrade-search-bar__input').fill('foo');

  // 디바운스 150ms + 약간의 여유 후 매칭 표시
  await expect(win.locator('.diagrade-search-match')).toHaveCount(5, { timeout: 5000 });
  // 활성 매칭 1 개
  await expect(win.locator('.diagrade-search-match.active')).toHaveCount(1);
  // 카운터 표시 (1/5 또는 다른 페이지의 활성)
  await expect(win.locator('.diagrade-search-bar__count')).toContainText('/5');
});

test('FR-04: Enter / Shift+Enter 로 매칭 순회', async () => {
  const file = join(tmpDir, 'note.md');
  writeFileSync(file, 'apple banana apple cherry apple\n', 'utf-8');
  await pushFiles(app, [file]);
  await openSearch(app);

  const input = win.locator('.diagrade-search-bar__input');
  await input.fill('apple');
  await expect(win.locator('.diagrade-search-match')).toHaveCount(3, { timeout: 5000 });

  // 처음 활성 인덱스 확인
  const initialCount = await win.locator('.diagrade-search-bar__count').textContent();
  expect(initialCount).toMatch(/^\d+\/3$/);

  // Enter — 다음 매칭으로
  await input.press('Enter');
  await win.waitForTimeout(100);
  const afterNext = await win.locator('.diagrade-search-bar__count').textContent();
  expect(afterNext).not.toBe(initialCount);

  // Shift+Enter — 이전 매칭으로 (원래 위치로 복귀)
  await input.press('Shift+Enter');
  await win.waitForTimeout(100);
  const afterPrev = await win.locator('.diagrade-search-bar__count').textContent();
  expect(afterPrev).toBe(initialCount);
});

test('FR-19: 매칭 0 개 → 0/0 빨간색 표시', async () => {
  const file = join(tmpDir, 'note.md');
  writeFileSync(file, 'hello world\n', 'utf-8');
  await pushFiles(app, [file]);
  await openSearch(app);

  await win.locator('.diagrade-search-bar__input').fill('zzz_no_match');
  await win.waitForTimeout(300);

  await expect(win.locator('.diagrade-search-bar__count')).toContainText('0/0');
  await expect(win.locator('.diagrade-search-bar__count--empty')).toBeVisible();
  await expect(win.locator('.diagrade-search-match')).toHaveCount(0);
});

test('FR-03: Esc → 검색바 닫힘 + 하이라이트 정리 + DOM 복원', async () => {
  const file = join(tmpDir, 'note.md');
  writeFileSync(file, '# heading\n\nfoo bar foo\n', 'utf-8');
  await pushFiles(app, [file]);
  await openSearch(app);

  const input = win.locator('.diagrade-search-bar__input');
  await input.fill('foo');
  await expect(win.locator('.diagrade-search-match')).toHaveCount(2, { timeout: 5000 });

  // 본문 textContent 캡처 (Esc 후 동일해야 함)
  const beforeText = await win.locator('.diagrade-markdown').textContent();

  await input.press('Escape');

  await expect(win.locator('.diagrade-search-bar')).toHaveCount(0);
  await expect(win.locator('.diagrade-search-match')).toHaveCount(0);
  // textContent 가 동일 — DOM 원본 복원 (NFR-03)
  const afterText = await win.locator('.diagrade-markdown').textContent();
  expect(afterText).toBe(beforeText);
});

test('FR-09: 정규식 metachar 가 literal 로 처리 (SEC-01)', async () => {
  const file = join(tmpDir, 'note.md');
  // 점 4 개 — 정규식이라면 점 = any-char 라 매칭이 훨씬 많아짐.
  writeFileSync(file, 'a.b c.d e.f g.h\n', 'utf-8');
  await pushFiles(app, [file]);
  await openSearch(app);

  await win.locator('.diagrade-search-bar__input').fill('.');
  await expect(win.locator('.diagrade-search-match')).toHaveCount(4, { timeout: 5000 });
});

test('FR-07: case-sensitive 토글', async () => {
  const file = join(tmpDir, 'note.md');
  writeFileSync(file, 'Apple apple APPLE\n', 'utf-8');
  await pushFiles(app, [file]);
  await openSearch(app);

  await win.locator('.diagrade-search-bar__input').fill('apple');
  // case-insensitive 기본 — 3 개 매칭
  await expect(win.locator('.diagrade-search-match')).toHaveCount(3, { timeout: 5000 });

  // Aa 토글 클릭 (PRD-007 후 토글이 여러 개라 aria-label 로 정확히 선택)
  await win.getByRole('button', { name: '대소문자 구분' }).click();

  // case-sensitive — 1 개 매칭 (소문자 'apple') — toHaveCount 가 폴링하므로 wait 불필요
  await expect(win.locator('.diagrade-search-match')).toHaveCount(1, { timeout: 5000 });
});

test('FR-13: SVG 안 텍스트 (mermaid) 는 검색 제외', async () => {
  const file = join(tmpDir, 'note.md');
  writeFileSync(
    file,
    '# 본문 mermaid 키워드\n\n```mermaid\nflowchart TD\nmermaid_label[mermaid label]\n```\n',
    'utf-8'
  );
  await pushFiles(app, [file]);

  // mermaid 가 SVG 로 변환될 때까지 대기
  await expect(win.locator('.diagrade-mermaid svg')).toBeVisible({ timeout: 10000 });

  await openSearch(app);
  await win.locator('.diagrade-search-bar__input').fill('mermaid');
  await win.waitForTimeout(300);

  // SVG 안의 'mermaid_label' / 'mermaid label' 은 매칭 X
  // 본문의 '# 본문 mermaid 키워드' 만 매칭 → 1 개
  // (코드 블록은 mermaid 가 SVG 로 교체했으므로 더 이상 본문에 없음)
  const matches = await win.locator('.diagrade-search-match').count();
  // 본문의 'mermaid' 1 개. SVG 안은 제외.
  expect(matches).toBe(1);
});

// PRD-007: 정규식 + Whole word 토글
test('PRD-007 FR-06: Whole word 토글 ON → 단어 단위 매칭', async () => {
  const file = join(tmpDir, 'wholeword.md');
  // 'set' 매칭: 1) "set" 2) "setting" 의 set 3) "subset" 의 set 4) "set" — 총 4
  writeFileSync(file, 'set setting subset set\n', 'utf-8');
  await pushFiles(app, [file]);
  await openSearch(app);

  await win.locator('.diagrade-search-bar__input').fill('set');
  // 토글 OFF 상태 — 모든 매칭 4
  await expect(win.locator('.diagrade-search-match')).toHaveCount(4, { timeout: 5000 });

  await win.getByRole('button', { name: '단어 단위 매칭' }).click();
  await win.waitForTimeout(200);

  // wholeWord ON — 단독 'set' 만 (2 개: 첫번째와 네번째 'set')
  await expect(win.locator('.diagrade-search-match')).toHaveCount(2);
});

test('PRD-007 FR-05: Regex 토글 ON → 패턴 매칭 (\\d+)', async () => {
  const file = join(tmpDir, 'regex.md');
  writeFileSync(file, '버전 1.2.3 빌드 4567 릴리스 89\n', 'utf-8');
  await pushFiles(app, [file]);
  await openSearch(app);

  // regex 토글 ON
  await win.getByRole('button', { name: '정규식 사용' }).click();
  await win.waitForTimeout(100);

  await win.locator('.diagrade-search-bar__input').fill('\\d+');
  await win.waitForTimeout(300);

  // 1, 2, 3, 4567, 89 — 5 개 숫자 시퀀스
  const count = await win.locator('.diagrade-search-match').count();
  expect(count).toBeGreaterThanOrEqual(5);
});

test('PRD-007 FR-05/SEC-01: 잘못된 regex → 0/0, 앱 크래시 X', async () => {
  const file = join(tmpDir, 'bad-regex.md');
  writeFileSync(file, 'foo bar baz\n', 'utf-8');
  await pushFiles(app, [file]);
  await openSearch(app);

  await win.getByRole('button', { name: '정규식 사용' }).click();
  await win.waitForTimeout(100);

  await win.locator('.diagrade-search-bar__input').fill('(unclosed');
  await win.waitForTimeout(300);

  // 0/0 표시 (--empty 클래스)
  await expect(win.locator('.diagrade-search-bar__count')).toContainText('0/0');
  await expect(win.locator('.diagrade-search-match')).toHaveCount(0);
  // 앱 정상 동작 — 다른 요소 클릭 가능
  await expect(win.locator('.diagrade-search-bar__input')).toBeVisible();
});

test('PRD-007 FR-03: Esc 닫고 재오픈 시 토글 모두 reset', async () => {
  const file = join(tmpDir, 'reset.md');
  writeFileSync(file, 'apple Apple APPLE\n', 'utf-8');
  await pushFiles(app, [file]);
  await openSearch(app);

  // 토글 모두 ON
  await win.getByRole('button', { name: '대소문자 구분' }).click();
  await win.getByRole('button', { name: '단어 단위 매칭' }).click();
  await win.getByRole('button', { name: '정규식 사용' }).click();
  await win.waitForTimeout(100);

  // 닫고 재오픈
  await win.locator('.diagrade-search-bar__input').press('Escape');
  await expect(win.locator('.diagrade-search-bar')).toHaveCount(0);

  await openSearch(app);
  // 모든 토글 OFF — aria-pressed=false
  await expect(win.getByRole('button', { name: '대소문자 구분' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await expect(win.getByRole('button', { name: '단어 단위 매칭' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await expect(win.getByRole('button', { name: '정규식 사용' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});
