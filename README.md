# Diagrade

[![CI](https://github.com/hjp7461/diagrade/actions/workflows/ci.yml/badge.svg)](https://github.com/hjp7461/diagrade/actions/workflows/ci.yml)

크로스플랫폼 마크다운 + Mermaid 다이어그램 뷰어. 다이어그램을 깔끔하게(grade) 저장하는 데 특화된 읽기 전용 뷰어.

## 이름의 유래

**Dia**gram + **grade** (품질). 마크다운 안의 Mermaid 다이어그램을 PNG/SVG 로 깨끗하게 뽑아내는 것이 이 도구의 핵심 가치. 단순 뷰어가 아니라 "다이어그램 export 가 깨지지 않는다" 가 차별점.

## 기술 스택

| 영역 | 선택 |
|---|---|
| 셸 | Electron 33+ |
| 언어 | TypeScript 5.x |
| 렌더러 | React 18 + Vite |
| 마크다운 파서 | markdown-it (+ GFM 플러그인) |
| 코드 하이라이트 | Shiki (lazy-load) |
| 다이어그램 | mermaid 11 (번들 포함) |
| HTML sanitize | DOMPurify |
| 패키징 | electron-builder |
| 테스트 | Vitest + Playwright |

배포는 GitHub clone / source download 후 사용자가 직접 빌드하는 방식. 코드 서명·자동 업데이트는 v1.0 범위 외.

## 빌드 / 실행

Node.js 22+ 필요. 그 외 사전 설치는 없음.

```bash
npm install
npm run dev          # 개발 (Vite HMR + Electron)
npm run build        # 프로덕션 번들 (out/)
npm test             # 단위 테스트 (Vitest)
npm run test:e2e     # E2E 테스트 (Playwright + Electron)
npm run lint         # ESLint
npm run typecheck    # TypeScript
```

### 산출물 만들기 (electron-builder)

```bash
npm run dist         # 현재 OS 자동 감지 — DMG / NSIS / AppImage
npm run dist:mac     # macOS DMG (arm64 + x64)
npm run dist:win     # Windows NSIS x64
npm run dist:linux   # Linux AppImage x64
npm run dist:dir     # 패키지 안 되는 unpacked dir (빠른 검증용)
```

산출물은 `release/` 디렉터리에 생성됩니다 (git 추적 제외).

### macOS 첫 실행 시 Gatekeeper 경고 우회

코드 서명 / Notarization 은 v1.0 범위 외입니다 (`PRD-001 §9`). DMG 또는 `.app` 을 처음 실행하면
**"확인되지 않은 개발자가 만든 앱이라 열 수 없습니다"** 경고가 뜹니다. 다음으로 우회하세요.

1. Finder 에서 `Diagrade.app` 을 **우클릭 (Control+클릭) → "열기"**
2. 다시 한 번 표시되는 다이얼로그에서 "열기" 클릭
3. 이후엔 일반 더블클릭으로 열림

또는 터미널에서 한 번:
```bash
xattr -dr com.apple.quarantine /Applications/Diagrade.app
```

## 수용 기준 검증

자동화된 검증과 수동 검증으로 나뉩니다.

### 자동 검증

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # 단위 테스트 — 146 케이스 (sanitize, 파일명, BOM, 보안 옵션 등)
npm run test:e2e     # E2E — 9 케이스 (실 Electron 런타임에서 보안/렌더/UI)
```

### 수동 검증 체크리스트

`npm run dist` 산출물에 대해 OS 별로 다음을 확인.

#### 공통 (모든 OS)

- [ ] 앱이 정상 실행되어 빈 환영 화면 표시
- [ ] `.md` / `.markdown` 파일 드래그앤드롭 → 본문 렌더
- [ ] 미지원 형식 (`.txt` 등) 드롭 → "지원하지 않는 파일 형식입니다: ..." 토스트
- [ ] 폴더 드롭 → 1-depth 마크다운만 자동 오픈, 서브디렉터리는 무시
- [ ] `Cmd/Ctrl+O` → 파일 다이얼로그 → 선택 → 탭으로 열림
- [ ] `Cmd/Ctrl+Shift+O` → 폴더 다이얼로그
- [ ] `Ctrl+Tab` / `Ctrl+Shift+Tab` 으로 탭 순회
- [ ] `Cmd/Ctrl+W` 로 활성 탭 닫기
- [ ] 최대 탭 수 (기본 20) 초과 시 안내 토스트 + 가능한 만큼만 오픈
- [ ] 같은 파일 두 번 열기 → 새 탭 안 만들고 기존 탭으로 포커스 (FR-19)
- [ ] Mermaid `flowchart` / `sequence` / `class` / `state` / `er` / `gantt` / `pie` 모두 렌더
- [ ] 잘못된 Mermaid 문법 → 원본 코드 + 에러 메시지 fallback (FR-08)
- [ ] Mermaid 차트 호버 → ⬇ PNG / ⬇ SVG 메뉴 페이드인 (FR-21)
- [ ] ⬇ SVG 클릭 → 저장 다이얼로그 → `{md-basename}-{N}.svg` 기본명
- [ ] ⬇ PNG 클릭 → 동상, `.png` 확장자
- [ ] 클릭 즉시 버튼이 `⏳ 생성 중…` + disabled, 완료 시 원복 (FR-30)
- [ ] `파일 > 다이어그램 저장 (SVG 일괄)` → 차트별 순차 다이얼로그, 취소 시 부분 결과 보존
- [ ] `Cmd/Ctrl+P` → PDF 저장. 저장된 PDF 에 ⬇ 버튼이 박히지 않음 (FR-37)

#### Live Reload (PRD-002)

- [ ] 외부 에디터 (vim, VS Code 등) 로 활성 탭의 파일 저장 → 본문 자동 갱신 (≤ 500ms)
- [ ] 긴 문서 중간 스크롤 상태에서 파일 변경 → 스크롤 위치 유지
- [ ] 파일 영구 삭제 → "파일이 삭제되었습니다: ..." 토스트 + 본문 유지
- [ ] vim `:w` (atomic save) → 토스트 미발생, 자연스러운 갱신
- [ ] `config.json` 의 `liveReload: false` 적용 → 파일 변경에 무반응
- [ ] 활성 탭 전환 시 watcher 가 새 탭 파일로 전환 (이전 탭 변경 무시)

#### 검색 (PRD-003)

- [ ] `Cmd/Ctrl+F` 또는 `보기 > 검색...` → 검색바 표시 + 입력란 자동 focus
- [ ] 입력 → 디바운스 후 모든 매칭 노란 하이라이트, 활성 매칭 진한 주황
- [ ] 활성 매칭이 **현재 보고 있는 페이지(viewport) 안 최상단** 매칭 (페이지 위쪽 / 아래쪽 폴백)
- [ ] `▲` / `▼` 또는 `Enter` / `Shift+Enter` 로 매칭 순회 + 자동 스크롤
- [ ] 카운터 `{현재}/{전체}` 정확 표시. 0 매칭 시 빨간 `0/0`
- [ ] `Aa` 토글 → case-sensitive 동작 (`Apple` vs `apple` 결과 변동)
- [ ] `Esc` → 검색바 닫힘, 모든 하이라이트 제거, 본문 textContent 원본과 동일
- [ ] PRD-002 자동 갱신 발생 시 검색이 열려있으면 새 본문에서 재검색
- [ ] PDF 내보내기 / 인쇄 시 검색바 박히지 않음 (검색 매칭 하이라이트는 시각 정보로 노출)
- [ ] Mermaid SVG 다이어그램 안 텍스트는 검색 매칭 X (의도된 OOS)

#### 다크 모드 (PRD-004 + PRD-005)

- [ ] 시스템 다크 모드 활성화 → 마크다운 본문이 자동으로 다크 (배경 어둡고 텍스트 밝음)
- [ ] 시스템 라이트 모드로 돌아가면 자동으로 라이트 복귀
- [ ] `config.json` 의 `theme: 'dark'` 강제 → 시스템 라이트라도 다크
- [ ] `config.json` 의 `theme: 'light'` 강제 → 시스템 다크라도 라이트
- [ ] Mermaid 다이어그램이 다크 테마로 렌더 (어두운 배경 + 명료한 노드 색)
- [ ] 코드 블록 (Shiki) 도 GitHub Dark 테마 자동 전환
- [ ] 검색 매칭 하이라이트가 다크 모드에서도 충분한 대비
- [ ] **앱 chrome (탭바 / 검색바 / 토스트 / 빈 화면 / 에러 박스) 도 다크** (PRD-005)
- [ ] PDF / SVG / PNG 산출물은 라이트 (export 흐름은 다크 영향 X)

#### PNG 해상도 (PRD-006)

- [ ] `config.json` 의 `pngScale: 1` → ⬇ PNG 가 viewBox × 1 픽셀 (저용량)
- [ ] `pngScale: 2` (기본) → 2× — Retina / 일반
- [ ] `pngScale: 3` 또는 `4` → 인쇄 / 4K 발표용
- [ ] 잘못된 값 (0, 5, 'big' 등) → default 2 폴백
- [ ] 변경 후 다음 ⬇ PNG export 부터 즉시 적용 (앱 재시작 X)

#### 검색 정규식 / Whole word (PRD-007)

- [ ] 검색바의 `Ab` 토글 → 단어 경계 매칭 (`set` 검색이 `setting`/`subset` 미매칭)
- [ ] 검색바의 `.*` 토글 → 정규식 모드 (`\d+`, `\w+`, `function \w+` 등 패턴 매칭)
- [ ] `Aa + Ab + .*` 자유 조합 — 모든 토글 독립
- [ ] 잘못된 정규식 (`(unclosed`, `[`) → 빨간 `0/0` + 앱 크래시 X
- [ ] zero-width regex (`(?=foo)`) → 무한 루프 X
- [ ] Esc 로 검색 닫으면 토글 모두 reset (다음 열 때 모두 OFF)

#### 산출물 호환성 (CLAUDE.md pitfalls 회귀 방지)

저장된 SVG 한 개를 골라:

```bash
# SVG XML 호환성 (v1 PRD-005 회귀 방지)
xmllint --noout *.svg                    # 통과해야 함
qlmanage -t -s 256 -o /tmp *.svg         # macOS Quick Look 미리보기 — 깨짐 X
file *.svg                               # "with BOM" 표시 안 되어야 함
```

저장된 PNG 한 개를 골라 (macOS):

```bash
# PNG viewBox × 2 해상도 (v1 PRD-006 회귀 방지)
sips -g pixelWidth -g pixelHeight *.png  # 출력값이 SVG viewBox 의 정확히 2 배여야 함
```

#### macOS 안정성 (v1 PRD-003/004 회귀 방지)

- [ ] 앱 실행 후 30 초 무조작 대기 — 크래시 없음
- [ ] 큰 마크다운 (10+ 다이어그램) 일괄 저장 → 크래시 없음
- [ ] 탭 10 개 이상 빠르게 전환 → 크래시 없음
- [ ] PDF 내보내기 반복 → 크래시 없음

> v1(C# / Avalonia) 의 `WKWebView._evaluateJavaScript` SIGABRT 는
> Electron 으로 이전하면서 .NET ↔ ObjC 경계 자체가 사라져 구조적으로 무관해짐.

#### airgap 동작 (NFR-06)

- [ ] 인터넷 없는 환경에서 mermaid / Shiki / 폰트 모두 정상 동작 (모두 번들)

## 아이콘 커스터마이징

기본 아이콘은 `assets/icon.png` (1024×1024 PNG) 한 파일이 모든 OS (macOS .icns, Windows .ico, Linux .png) 의 소스가 됩니다 — electron-builder 가 빌드 시 OS 별 형식으로 자동 변환합니다.

```bash
# 사용자 아이콘으로 교체 (1024×1024 PNG 권장)
cp my-icon.png assets/icon.png
npm run dist  # 새 아이콘으로 산출물 빌드

# 기본 아이콘으로 되돌리기 (또는 처음 생성)
node scripts/generate-default-icon.mjs --force
```

런타임에서 BrowserWindow 의 작업표시줄 아이콘도 같은 파일을 사용 (`extraResources` 로 패키지에 포함). `assets/icon.png` 가 없으면 Electron 기본 아이콘으로 안전 폴백.

## 라이선스

MIT
