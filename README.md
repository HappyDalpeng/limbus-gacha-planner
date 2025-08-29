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

## 수학적 원리(계산 방식)

이 앱이 그래프·표를 계산하는 방법을 수식으로 표현합니다. (구현은 `src/lib/prob.ts`).

### 기본 카테고리 확률

- 기본값(일반 추출): E.G.O 1.3%, 3성 2.9%, 2성 12.8%, 1성 83.0%
- 여기에 아래 조건에 따라 확률이 독립적으로 변동됩니다.
  - 아나운서 포함: 아나운서 1.3% 추가, 1성은 1.3%p 감소
  - E.G.O를 전부 보유하면: E.G.O 0%, 3성 3.0%, 2성 13.0%, 1성은 나머지

### 특정 추출 반영

특정 추출의 경우, 해당 카테고리의 기본 확률 중 절반을 픽업이 가져갑니다. 픽업 목록이 $f_X$개이고 그중 내가 원하는 것이 $d_X$개라면, 카테고리 X에서 “원하는 대상”의 1회 확률은

$$
p_X^{\text{want}} \,=\, \tfrac{1}{2}\,p_X^{\text{base}}\,\cdot\,\frac{d_X}{f_X}\quad(\text{clip to }[0,1])
$$

로 계산합니다.

### 10연 마지막 2성 확정

- 1~9번째는 기본 확률과 동일
- 연차(10연) 10번째만 2성 확정(계산상 `p2+=p1, p1=0` 처리)
- 본 웹페이지는 3성 인격만 취급하므로, 알아만 두면 됩니다.

### 누적 달성 확률 $F(n)$

천장으로 채운 보증 개수를 $c_X$라 할 때 남은 필요량은 $m_X=\max(0, d_X-c_X)$. 범주별 성공 횟수를 $K_X\sim\mathrm{Binomial}(n,p_X^{\text{want}})$로 두고

$$
\begin{aligned}
\Pr[K_X\ge m_X] \,&=\, \sum_{k=m_X}^{n} {n\choose k}\,(p_X^{\text{want}})^k(1-p_X^{\text{want}})^{n-k},\\
F(n) \,&=\, \prod_X \Pr[K_X\ge m_X] .
\end{aligned}
$$

### 천장(200뽑) 배분

$n$회에서 천장은 $\lfloor n/200\rfloor$개 발생. 각 천장은 경계 $n=200r-1$에서

$$
\Delta_X\;\approx\;\Pr[K_X = m_X-1]
$$

이 가장 큰 카테고리 $X$에 그리디하게 할당하여 $c_X$를 갱신합니다.

### 분위수와 Before/After 표

- 분위수 $q$: 최소 $n_q=\min\{n\mid F(n)\ge q\}$를 이분 탐색으로 구함
- Before/After: 각 $r$에 대해 $n=200r-1$과 $n=200r$에서의 $F(n)$을 표로 표시

### 재화 → 뽑기 환산(10연 우선)

광기($L$)를 10연과 1연로 환산하고, 보유 티켓과 합산합니다.

$$
T_{10}^{(L)} = \left\lfloor \tfrac{L}{1300} \right\rfloor,\quad
L' = L - 1300\,T_{10}^{(L)},\quad
T_{1}^{(L)} = \left\lfloor \tfrac{L'}{130} \right\rfloor.
$$

총 뽑기 수는

$$
N_{\text{res}} \,=\, 10\,(\,T_{10} + T_{10}^{(L)}\,) + (\,T_{1} + T_{1}^{(L)}\,).
$$

### 자동 최대 범위

최대 계산 범위는 천장 주기(200) × 목표 개수 합으로 설정합니다.

### 가정과 한계

- 카테고리 간 성공은 독립으로 가정합니다.
- 실제 게임에서의 확률 계산과 동일하지 않을 수 있으며, 계산 효율을 위한 트릭이 존재합니다.
