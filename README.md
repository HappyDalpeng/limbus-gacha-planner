# 림버스 가챠 플래너

[링크](https://happydalpeng.github.io/limbus-gacha-planner/)

게임 림버스 컴퍼니의 픽업에 필요한 뽑기 수와 목표 달성 확률을 직관적으로 확인할 수 있는 웹 플래너입니다.

## 사용자 주의 사항

계산 효율과 모델 단순화를 위해, 내부 확률 계산에 많은 가정과 최적화가 포함되어 있습니다.

실제 게임에서의 확률 계산과 동일하지 않을 수 있으니, 본 플래너는 참고용으로만 사용해주세요.

자세한 계산 방식이 궁금하신 경우 [확률 계산 방식](./docs/math.md) 문서를 확인해주세요.

## 개발자 안내

- 기술 스택: Vite, React 19, TypeScript, Tailwind v4, i18next, Recharts
- 실행

```bash
npm i
npm run dev
```

- 빌드

```bash
npm run build
```

- 빠른 코드 작성 및 다국어 지원을 위해 Codex로 GPT-5와 함께 작업했습니다.

## Disclaimer

이 플래너는 비공식 팬메이드이며, 모든 게임 관련 권리는 각 저작권자에게 귀속됩니다.
CC0 라이센스로, 자유롭게 사용, 수정 및 배포가 가능합니다.
