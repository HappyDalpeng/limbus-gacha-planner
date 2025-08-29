# 용어 및 i18n 정리 (KR 우선)

이 문서는 KR/EN/JA 커뮤니티 용례에 맞춘 용어/번역 기준과, 코드·i18n 키 대응을 정리합니다. 기본 서술은 한국어이며, EN/JA는 괄호로 병기합니다.

## 목적
- UI/README/코드 전반의 용어 일관성 유지
- 림버스 커뮤니티 관용 표현 반영
- i18n 키와 변수명 기준 문서화로 드리프트 방지

## 핵심 용어(KR · EN · JA)
- 뽑기 단위: 단차(1회) · single/1‑pull · 単発 / 연차(10연) · 10‑pull · 10連
- 픽업 분배: 픽업/비픽업 50:50 · pickup/off‑banner (50:50) · ピックアップ/非ピック(50:50)
- 10연 규칙: 10연 마지막 2성 확정 · 10th is 2★ guaranteed · 10連の最後は2★確定
- 천장: 천장(200뽑), 교환/정가 · pity (every 200) · 天井(200回), 交換
- 픽업 실패: 픽뚫 · off‑rate/off‑banner · すり抜け
- 카테고리: 인격(3성·2성·1성)/E.G.O/아나운서 · Identity/E.G.O/Announcer · 人格/E.G.O/アナウンサー
- 재화/보상: 광기 · Lunacy · ルナシー / 파편 · shards · 欠片 / 끈상자 · String Box · (JP는 맥락상 표기 생략 가능)

## 문구 선택 기준
- “픽업”을 기본 용어로 사용(EN: pickup, JA: ピックアップ). UI에서 “featured”는 지양.
- 10연 문구는 “마지막 2성 확정”을 기본(EN: 10th guaranteed, JA: 確定). “보정/boost”는 부제 수준.
- 천장 표기는 숫자 병기: “천장(200뽑) / Pity (200) / 天井(200)”.
- 픽뚫/오프배너/すり抜け 등 속어는 UI 필수 아님(문서에서만 필요 시 사용).

## i18n 키(발췌)
- `targets`: 목표 · Targets · 目標
- `pickupCount`: 픽업 대상 개수 · Pickup count · ピックアップ対象数
- `desiredCount`: 원하는 대상 개수 · Desired count · 欲しい対象数
- `syncDesired`: 원하는 개수=픽업 대상 개수 · Set desired = pickup · 欲しい数をピックアップ数に揃える
- `announcer`: 아나운서 · Announcer · アナウンサー
- `ego`: E.G.O · E.G.O · E.G.O
- `threeStar`: 3성 인격 · 3★ Identity · 3★人格
- `resources`: 보유 재화 · Resources · 所持リソース
- `lunacy`: 광기 · Lunacy · ルナシー
- `ticket1`/`ticket10`: 추출 1회/10회 티켓 · 1‑pull/10‑pull Ticket · 単発/10連チケット
- `beforeAfter`: 천장별 Before/After 확률 · Pity Before/After · 天井別 Before/After
- `legend.pity`: 천장 경계선 · Pity thresholds · 天井の区切り

참조 파일:
- `src/locales/ko.json:1`
- `src/locales/en.json:1`
- `src/locales/ja.json:1`

## 변수명 기준(코드)
- `Targets = { A|E|T: { pickup: number; desired: number } }`
  - 배경: 커뮤니티 용어에 맞춰 `featured` → `pickup`으로 정리
- 주요 함수
  - `wantProbPerCategory(...)`: `targets.X.pickup`을 사용해 픽업 분배 반영
  - `baseCategoryProbs(hasAnnouncer, egoAvailable)`: 기본 확률(아나운서/E.G.O 보유 여부) 제어

코드 위치:
- `src/lib/prob.ts:1`
- `src/lib/prob.ts:66`
- `src/components/SettingsPanel.tsx:114`
- `src/App.tsx:20`

## 문서/UI 서식 템플릿
- 픽업 수식: “카테고리 확률은 픽업/비픽업 반반(50:50). 원하는 1회 확률 = 0.5×기본확률×(원하는 수/픽업 수).”
- 10연: “단차는 기본 확률, 연차의 10번째만 2성 확정.”
- 천장: “200뽑마다 1천장. 천장마다 교환은 주변 이득이 큰 카테고리로.”

## 커뮤니티 메모
- KR: 단차/연차, 픽업/픽뚫, 10연 마지막 확정, 천장/정가 용례 잦음
- EN: pickup/off‑banner, pity, 10th guaranteed
- JA: 単発/10連, ピックアップ/すり抜け, 天井, 確定(ルナシー採用)

## 논의 필요 사항
- E.G.O 가용 여부 UI: `egoAvailable` 토글 노출 or `targets.E.pickup = 0`일 때 자동 처리(현재 호출은 `true` 고정)
- JA `tabs.perc` 번역: “運カード”로 적용(이전: 運認証). 피드백에 따라 “達成カード” 등으로 조정 가능
