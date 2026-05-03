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
