# Diagrade

크로스플랫폼 마크다운 + Mermaid 다이어그램 뷰어. 다이어그램을 깔끔하게(grade) 저장하는 데 특화된 읽기 전용 뷰어.

## 이름의 유래

**Dia**gram + **grade** (품질). 마크다운 안의 Mermaid 다이어그램을 PNG/SVG 로 깨끗하게 뽑아내는 것이 이 도구의 핵심 가치. 단순 뷰어가 아니라 "다이어그램 export 가 깨지지 않는다" 가 차별점.

## 주요 기능

- **보기** — 마크다운 + Mermaid 렌더링, 코드 하이라이트, 다이어그램 확대보기
- **내보내기** — 다이어그램별 PNG / SVG 저장, 문서 전체 일괄 저장, PNG 배율 1~4배, 문서 PDF 내보내기
- **열기** — 파일 / 폴더 열기, 드래그 앤 드롭, OS 의 "연결 프로그램" 으로 `.md` / `.markdown` 열기, 탭
- **검색** — 대소문자 구분, 단어 단위, 정규식
- **기타** — 파일 변경 시 자동 새로고침, 라이트 / 다크 / 시스템 테마

## 기술 스택

| 영역 | 선택 |
|---|---|
| 셸 | Electron 41 |
| 언어 | TypeScript 6 |
| 렌더러 | React 19 + Vite 7 |
| 마크다운 파서 | markdown-it (+ task-lists 플러그인) |
| 코드 하이라이트 | Shiki 4 (lazy-load) |
| 다이어그램 | mermaid 11 (번들 포함) |
| HTML sanitize | DOMPurify 3 |
| 패키징 | electron-builder 26 |
| 테스트 | Vitest 4 + Playwright |

배포는 GitHub clone / source download 후 사용자가 직접 빌드하는 방식이 기본 (Windows / macOS 는 예외적으로 릴리즈에 산출물 제공). 코드 서명·자동 업데이트는 v1.0 범위 외.

## 설치하기

Diagrade 는 **GitHub 에서 소스코드를 받아 본인 머신에서 직접 빌드** 하는 방식이 기본입니다 (코드 서명 / 자동 업데이트 인프라가 의도적으로 비활성).

> **Windows / macOS 사용자**: 요청이 있어 [v0.1.0 릴리즈](https://github.com/hjp7461/diagrade/releases/tag/v0.1.0)에 예외적으로 설치 파일을 올려 두었습니다. 빌드 없이 바로 쓰려면 그쪽을 받으시면 됩니다 (서명이 없어 최초 1회 보안 경고 우회 필요 — Windows 는 SmartScreen, macOS 는 `xattr`. 릴리즈 노트에 절차 있음). Linux 용 산출물은 제공하지 않으니 아래 절차대로 직접 빌드해 주세요.

### 사전 준비

- **Node.js 22.13 이상** — [nodejs.org](https://nodejs.org/) 에서 LTS 다운로드. 버전 확인:
  ```bash
  node --version    # v22.13.0 또는 그 이상
  ```
- **git** — 보통 OS 에 기본 설치 (`git --version` 으로 확인)

### 설치 / 빌드

```bash
# 1. 저장소 받기
git clone https://github.com/hjp7461/diagrade.git
cd diagrade

# 2. 의존성 설치 (한 번만)
npm install

# 3. 본인 OS 용 설치 파일 만들기
npm run dist
```

빌드가 끝나면 `release/` 디렉터리에 OS 별 산출물이 생성됩니다.

| OS | 산출물 | 위치 예시 |
|---|---|---|
| macOS | DMG (Apple Silicon / Intel 각각) | `release/Diagrade-x.y.z-arm64.dmg` (Apple Silicon), `release/Diagrade-x.y.z.dmg` (Intel) |
| Windows | NSIS 설치 마법사 | `release/Diagrade Setup x.y.z.exe` |
| Linux | AppImage (단일 파일) | `release/Diagrade-x.y.z.AppImage` |

> 첫 빌드는 Electron prebuilt 다운로드 때문에 5~10 분 정도 걸립니다. 두 번째부터는 캐시되어 빠릅니다.

### 처음 실행 (OS 별 가이드)

코드 서명을 적용하지 않아 OS 에 따라 처음 실행 시 보안 경고가 나올 수 있습니다. **한 번만 우회하면** 이후 일반 실행 가능합니다.

#### macOS

DMG 더블클릭으로 마운트 → `Diagrade.app` 을 `/Applications` 폴더로 드래그.

본인 머신에서 빌드한 DMG 는 경고 없이 바로 실행됩니다. 릴리즈에서 내려받은 DMG 라면 **"손상되었기 때문에 열 수 없습니다"** 또는 **"확인되지 않은 개발자"** 경고가 뜰 수 있는데, 이때는 터미널에서:

```bash
xattr -dr com.apple.quarantine /Applications/Diagrade.app
```

#### Windows

설치 파일 더블클릭 → 설치 마법사 따라 진행. 파일명은 직접 빌드했다면 `Diagrade Setup *.exe`, 릴리즈에서 받았다면 `Diagrade.Setup.*.exe` 입니다.

설치 도중 또는 첫 실행 시 **"Windows의 PC 보호"** SmartScreen 경고가 뜨면:

1. **"추가 정보"** 클릭
2. 표시되는 **"실행"** 버튼 클릭

#### Linux

AppImage 는 별도 설치 절차 없이 단일 파일로 실행됩니다.

```bash
chmod +x release/Diagrade-*.AppImage     # 실행 권한 부여 (한 번만)
./release/Diagrade-*.AppImage            # 실행
```

파일 매니저에서 더블클릭으로도 실행 가능합니다 (배포판마다 동작 차이).

### 다른 빌드 옵션

```bash
npm run dist:mac       # macOS DMG 강제
npm run dist:win       # Windows NSIS 강제
npm run dist:linux     # Linux AppImage 강제
npm run dist:dir       # 패키지 안 만들고 unpacked 폴더만 (빠른 검증용)
```

> **Cross-OS 빌드 한계**: macOS 에서 Windows `.exe` 를 만들 수는 있지만 wine 의존 + 검증 부담 때문에 권장하지 않습니다. **각 OS 의 머신에서 본인이 사용할 OS 의 산출물을 빌드** 하는 흐름이 표준입니다.

### 업데이트 (새 버전 받기)

자동 업데이트는 의도적으로 비활성화되어 있습니다. 새 버전이 필요할 때:

```bash
cd diagrade
git pull
npm install        # 의존성이 바뀐 경우 (대부분 필요)
npm run dist       # 새 산출물 빌드
```

기존 설치를 새 산출물로 덮어쓰면 됩니다. 사용자 설정은 OS 별 user data 디렉터리에 보관되어 업데이트 후에도 유지됩니다.

### 자주 마주치는 문제

- **빌드가 멈추거나 에러로 끝남** — `out/`, `release/`, `node_modules/.cache/` 를 지우고 다시 시도:
  ```bash
  rm -rf out release node_modules/.cache
  npm run dist
  ```
- **앱 아이콘이 Electron 기본 아이콘으로 나옴** — `assets/icon.png` 가 없어도 빌드는 성공합니다. 파일을 복원한 뒤 다시 빌드:
  ```bash
  git checkout -- assets/icon.png
  npm run dist
  ```
- **macOS 빌드가 너무 느림 (arm64 + x64 각각 빌드)** — Apple Silicon 만 필요하면 `electron-builder.yml` 의 `mac.target.arch` 를 `[arm64]` 로 좁혀 빌드 시간 절반.

## 개발자용

소스를 직접 실행하거나 검증할 때:

```bash
npm run dev          # Vite HMR + Electron 실행 (소스 변경 즉시 반영)
npm run build        # 프로덕션 번들만 (out/, 패키징 X)
npm test             # 단위 테스트 (Vitest)
npm run test:e2e     # E2E 테스트 (Playwright + Electron)
npm run lint         # ESLint
npm run typecheck    # TypeScript 검증
```

> **`test:e2e` 실행 전 Diagrade 를 종료하세요.** 설치한 앱이 실행 중이면 단일 인스턴스 잠금 때문에 테스트가 실패합니다. 앱을 끄기 어렵다면 사용자 데이터 경로를 분리해 실행합니다: `DIAGRADE_USER_DATA=$(mktemp -d) npm run test:e2e`

## 아이콘 커스터마이징

기본 아이콘은 `assets/icon.png` (1024×1024 PNG) 한 파일이 모든 OS (macOS .icns, Windows .ico, Linux .png) 의 소스가 됩니다 — electron-builder 가 빌드 시 OS 별 형식으로 자동 변환합니다.

```bash
# 사용자 아이콘으로 교체 (1024×1024 PNG 권장)
cp my-icon.png assets/icon.png
npm run dist  # 새 아이콘으로 산출물 빌드

# 기본 아이콘으로 되돌리기
git checkout -- assets/icon.png
```

런타임에서 BrowserWindow 의 작업표시줄 아이콘도 같은 파일을 사용 (`extraResources` 로 패키지에 포함). `assets/icon.png` 가 없으면 Electron 기본 아이콘으로 안전 폴백.

## 라이선스

[MIT](LICENSE)

---

*이 문서는 100% Claude 가 작성했습니다.*
