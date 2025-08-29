# 📑 가챠 확률 플래너 (Tailwind v4)

Vite + React 19 + TypeScript + **Tailwind v4** + i18next + Recharts

## 실행
```bash
npm i
npm run dev
```

## Tailwind v4
- Vite 플러그인: `@tailwindcss/vite`
- CSS: `@import "tailwindcss";`
- 다크 모드: `@custom-variant dark` + `.dark` 토글 (index.html에 초기 스크립트 포함)

## 빌드
```bash
npm run build
```

기능: 재화 자동 환산(10연 우선), 누적 확률 곡선/수직선, 천장 Before/After 표, 운 인증 카드(이미지 저장), 다국어/다크모드/반응형.