# Diagrade

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

Node.js 22+ 필요.

```bash
npm install
npm run dev          # 개발 (Vite HMR + Electron)
npm run build        # 프로덕션 번들
npm run dist         # 현재 OS 산출물 (DMG / NSIS / AppImage)
npm test             # 단위 테스트 (Vitest)
npm run lint         # ESLint
npm run typecheck    # TypeScript
```

## 라이선스

MIT
