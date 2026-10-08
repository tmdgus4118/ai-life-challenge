---
name: 이웃소리
description: 층간소음 AI 기록·중재 서비스. 시끄럽다는 말 대신, AI가 정리한 기록으로 이웃과 대화하세요.
colors:
  primary: "#246BEB"
  primary-strong: "#0B50D0"
  primary-deep: "#083891"
  primary-mist: "#86AEF4"
  primary-wash: "#D3E1FB"
  primary-tint: "#ECF2FE"
  exceed: "#EB003B"
  exceed-strong: "#BA0029"
  exceed-wash: "#FBD5DD"
  exceed-tint: "#FDEEF1"
  surface: "#FFFFFF"
  surface-quiet: "#F7F8FA"
  ground: "#F1F3F6"
  line: "#E3E7EC"
  line-strong: "#CDD1D5"
  ink-faint: "#9BA4AE"
  ink-muted: "#626D78"
  ink-soft: "#4F5862"
  ink-strong: "#3B424A"
  ink: "#1A1D21"
  night-band: "#E9EEF7"
  night-ground: "#0E1524"
  night-surface: "#172133"
typography:
  measure:
    fontFamily: "Pretendard GOV Variable, Pretendard GOV, Pretendard Variable, -apple-system, Apple SD Gothic Neo, Noto Sans KR, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "\"tnum\""
  display:
    fontFamily: "Pretendard GOV Variable, Pretendard GOV, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.32
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Pretendard GOV Variable, Pretendard GOV, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Pretendard GOV Variable, Pretendard GOV, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Pretendard GOV Variable, Pretendard GOV, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Pretendard GOV Variable, Pretendard GOV, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "10px"
  md: "14px"
  icon: "16px"
  sheet: "20px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "46px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-strong}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "46px"
  button-disabled:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  badge-exceed:
    backgroundColor: "{colors.exceed-tint}"
    textColor: "{colors.exceed-strong}"
    rounded: "{rounded.pill}"
  badge-ok:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary-deep}"
    rounded: "{rounded.pill}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "44px"
    padding: "8px 12px"
---

# Design System: 이웃소리

## Overview

**Creative North Star: "공공 측정 보고서"**

이웃소리의 화면은 관공서가 발행하는 측정 보고서처럼 읽혀야 합니다. 무엇을 쟀는지, 어느 기준과 비교했는지, 그 기준의 출처가 무엇인지가 숫자보다 먼저 서 있고, 해석 문장은 단정하지 않습니다. 정부 디지털 서비스 디자인 시스템(KRDS)의 파랑·빨강·청회색을 그대로 쓰되, 화면의 완성도는 Apple 건강·소음 앱처럼 큰 측정값과 조용한 라벨, 한눈에 읽히는 데이터 그래픽으로 끌어올립니다.

밀도는 중간입니다. 한 카드에 한 가지 질문만 답하고, 수치 목록은 구분선으로 나눈 정의 목록으로 씁니다. 같은 크기의 숫자 카드 여러 장을 늘어놓는 대시보드는 쓰지 않습니다. 대표 요소는 24시간 소음 다이얼입니다. 0시가 위인 하루 시계에 야간(22~06시) 음영 띠를 깔고, 시간별 사건을 바깥으로 뻗는 막대로, 기준 초과분은 안쪽부터 빨강으로 쌓습니다.

밤에 어두운 방에서 쓰는 도구이므로 야간에는 같은 의미색을 유지한 채 남색 바탕의 어두운 화면으로 바뀝니다(사용자 설정 "야간 자동"). 움직임은 상태가 바뀌는 순간에만 있고, 반복하는 장식 애니메이션은 없습니다.

**Key Characteristics:**
- 의미색은 두 개뿐입니다. 기준 초과는 빨강, 정상·주요 동작은 파랑입니다.
- 측정값은 크고 굵게, 단위와 라벨은 작고 조용하게 씁니다. 숫자는 항상 tabular 숫자입니다.
- 모든 판정 옆에 근거(기준값, 측정 방식, 출처)가 붙고, "공인 측정 아님" 고지가 화면마다 있습니다.
- 데모(모의) 데이터는 점선 배지로 항상 드러냅니다.
- 아이콘은 1.8px 선의 SVG 한 세트(src/shared/icons.js)만 씁니다.

## Colors

KRDS 색상 체계에서 가져온 파랑 한 계열과 빨강 한 계열, 그리고 약간 푸른 기가 도는 청회색 중립으로 이루어진 절제된 팔레트입니다.

### Primary
- **행정 파랑** (#246BEB): 주요 버튼, 선택된 탭·칩, 기준 이내 막대의 정점, 링크, 포커스 링. 화면에서 "해야 할 일"과 "정상"을 동시에 뜻합니다.
- **짙은 행정 파랑** (#0B50D0): 링크와 보조 버튼 글자, 아이콘 선.
- **심야 파랑** (#083891): 큰 측정 숫자, 히트맵 최고 단계, 정상 배지 글자.
- **안개 파랑** (#86AEF4): 기준 이내 다이얼 막대, 직전 10초 막대.
- **옅은 파랑 면** (#D3E1FB / #ECF2FE): 안내문 바탕, 선택된 선택지, AI 요약문 바탕, 아이콘 받침.

### Secondary
- **초과 빨강** (#EB003B): 기준 초과 막대·점·테두리, 위험 버튼, 감지 중 상태 점. 판정 결과에만 씁니다.
- **짙은 초과 빨강** (#BA0029): 초과 수치 글자, 초과 배지 글자, 법·안전 경고 제목.
- **옅은 빨강 면** (#FDEEF1 / #FBD5DD): 초과 배지 바탕, 긴급 신고 띠, 증가 칩.

### Neutral
- **보고서 바탕** (#F1F3F6): 페이지 바탕. 흰 카드가 한 단계 떠 보이게 합니다.
- **종이** (#FFFFFF): 카드, 시트, 입력란.
- **조용한 종이** (#F7F8FA): 목록 행, 상세 칸, 보조 카드.
- **구분선** (#E3E7EC) / **강한 구분선** (#CDD1D5): 카드 테두리, 정의 목록 구분선, 입력 테두리.
- **잉크** (#1A1D21) ~ **흐린 잉크** (#9BA4AE): 본문(#1A1D21), 보조 문장(#4F5862), 라벨·메타(#626D78), 비활성(#9BA4AE).
- **야간 띠** (#E9EEF7): 다이얼과 히트맵·시간대 막대의 야간 구간 음영.
- **어두운 화면** (#0E1524 바탕, #172133 면): 야간 자동·어둡게 설정에서 같은 역할의 토큰을 다시 정의합니다. 의미색은 밝기만 올려(#5B95FF, #FF5A79) 대비를 유지합니다.

### Named Rules
**The Two Signals Rule.** 의미를 가진 색은 초과 빨강과 행정 파랑 두 개뿐입니다. 경고·주의·성공 같은 세 번째 의미색을 추가하지 않습니다.

**The Red Is a Verdict Rule.** 빨강은 기준 초과 판정, 삭제처럼 되돌릴 수 없는 동작, 법적 위험 안내에만 씁니다. 꾸밈이나 강조에 쓰지 않습니다.

## Typography

**Display Font:** Pretendard GOV Variable (Pretendard GOV, Apple SD Gothic Neo, Noto Sans KR 대체)
**Body Font:** 같은 가족 하나로 모든 역할을 씁니다.

**Character:** 공공 서비스용으로 다듬은 한글 고딕 한 가족이 측정값부터 라벨까지 모두 맡습니다. 위계는 크기와 굵기로만 만들고, 자간은 살짝 좁혀(-0.01em 본문, -0.03em 큰 숫자) 단정하게 둡니다. 한국어는 단어 단위로 줄바꿈합니다(word-break: keep-all).

### Hierarchy
- **Measure** (800, 56px, 1): 감지 화면 현재 dB. 다이얼 가운데 총계(46px), 메인 소개 화면 예시 다이얼(40px)도 같은 성격입니다.
- **Display** (800, 26px → 640px 이상 30px, 1.32): 메인 소개 화면 한 줄 소개뿐입니다.
- **Headline** (700, 18px, 1.45, 28ch): 다이얼 아래 핵심 패턴 문장.
- **Title** (700, 16px, 1.4): 카드 제목.
- **Body** (400, 15px, 1.55): 본문. AI 요약문은 16px, 1.8, 최대 70ch.
- **Label** (600, 13px): 상태 단어, 범례, 배지, 메타 정보. 하단 탭은 11~12px, 히트맵 시각 라벨은 11px입니다.
- **Fact number** (800, 22px): 수치 목록의 숫자. 단위는 15px로 붙입니다.

### Named Rules
**The Number Leads Rule.** 측정값은 라벨보다 최소 두 단계 크게 쓰고, 단위는 숫자보다 작게 붙입니다. 숫자는 tabular-nums로 자릿수가 흔들리지 않게 합니다.

## Layout

모바일 우선 한 줄 흐름입니다. 본문 폭은 560px까지, 좌우 여백 16px, 카드 사이 간격 14px입니다. 하단 탭(감지·기록·리포트·중재·설정, 높이 64px)이 화면 아래에 고정되고, 법·대응 안내는 머리말 오른쪽 버튼에서 들어갑니다.

640px 이상에서는 수치 목록이 두 칸이 됩니다. 1024px 이상에서는 하단 탭이 왼쪽 세로 메뉴(폭 108px)로 바뀌고, 감지·기록·리포트 화면은 최대 1080px 폭에서 두 칸(.split, 1.05fr : 1fr)으로 나뉩니다. 그 밖의 화면은 760px 한 줄입니다. 두 칸 안의 수치 목록은 다시 한 칸으로 돌아갑니다.

리포트 첫 화면은 기간 선택 아래 다이얼이 화면 폭 전체를 차지하고, 그 아래 핵심 패턴 문장과 증감 문장이 옵니다. 감지 첫 화면은 큰 dB와 상태 단어, 기준선 게이지, AI가 듣는 상위 3개 소리, 녹음 버튼이 탭 위 한 화면 안에 들어가야 합니다.

## Elevation & Depth

거의 평평한 체계입니다. 깊이는 청회색 바탕 위에 흰 면이 놓이는 한 단계 차이와 1px 구분선으로 만들고, 그림자는 아주 옅게 한 종류만 씁니다.

### Shadow Vocabulary
- **종이 그림자** (`box-shadow: 0 1px 2px rgba(26,29,33,.05), 0 4px 14px rgba(26,29,33,.04)`): 카드와 요약 칸. 어두운 화면에서는 `0 1px 2px rgba(0,0,0,.3)`.
- **녹음 버튼 그림자** (`box-shadow: 0 6px 16px rgba(26,29,33,.16), 0 1px 3px rgba(26,29,33,.12)`): 감지 시작 버튼 하나에만 씁니다. 색 있는 빛 번짐(glow)은 쓰지 않습니다.

### Named Rules
**The One Step Up Rule.** 면은 바탕보다 딱 한 단계만 뜹니다. 카드 안에 그림자 있는 카드를 넣지 않습니다.

## Shapes

부드럽지만 둥글둥글하지 않은 모서리입니다. 카드 14px, 버튼·입력·목록 행 10px, 아이콘 받침 11~18px, 아래에서 올라오는 시트 위쪽 20px, 칩·배지·세그먼트 탭은 알약 모양(999px)입니다. 테두리는 1px 구분선이고, 데모 표시만 점선 테두리를 씁니다. 다이얼은 원과 고리 부채꼴로만 그립니다.

## Components

### Buttons
- **Shape:** 모서리 10px, 높이 46px, 글자 15px/650, 아이콘은 18px로 글자 앞에 붙습니다.
- **Primary:** 행정 파랑 바탕에 흰 글자. 화면당 하나의 주된 동작에만 씁니다.
- **Secondary:** 흰 바탕, 행정 파랑 테두리와 글자.
- **Ghost / Danger:** 흐린 테두리 / 초과 빨강 바탕.
- **Press / Focus:** 누르면 scale(0.97), 140ms ease-out. 포커스는 2px 파랑 외곽선(간격 2px).
- **Disabled:** 투명도를 낮추지 않고 #F1F3F6 바탕, #626D78 글자로 바꿔 대비를 지킵니다.

### Record Button (감지 시작)
지름 112px 원형. 대기 중은 파랑에 흰 원, 감지 중은 빨강에 둥근 사각형과 고정 링입니다. 반복 맥박 애니메이션은 쓰지 않습니다.

### Chips / Segmented / Choice
- **Chip:** 흰 바탕, 흐린 테두리, 알약 모양. 선택되면 파랑 바탕·흰 글자. 소음원 칩은 16px 아이콘을 앞에 둡니다.
- **Segmented:** 회색 홈 안에서 선택된 칸만 흰 면으로 떠오릅니다(기간, 수신자).
- **Choice:** 라디오 선택지는 선택되면 파랑 테두리와 옅은 파랑 면.

### Cards / Fact List
- **Card:** 흰 면, 14px 모서리, 1px 구분선, 종이 그림자, 안쪽 여백 16px.
- **Fact list:** 정의 목록. 왼쪽 회색 라벨, 오른쪽 굵은 값, 행 사이 1px 구분선. 숫자 카드 격자를 대신합니다.

### Badges
초과(옅은 빨강 면·짙은 빨강 글자), 이내(옅은 파랑 면·심야 파랑 글자), 데모(회색 면·점선 테두리), 현재 단계(파랑 면).

### Inputs
흰 바탕, 1px 강한 구분선, 10px 모서리, 높이 44px. 포커스는 파랑 외곽선, 커서도 파랑입니다.

### Navigation
모바일 하단 탭 5개(아이콘 24px + 11px 라벨, 선택 시 짙은 파랑). 데스크톱은 같은 항목의 왼쪽 세로 메뉴이며 선택 칸에 옅은 파랑 면이 깔립니다. 머리말 오른쪽의 "법·대응 안내"는 알약 모양 보조 링크입니다.

### 24시간 소음 다이얼 (Signature)
src/shared/dial.js가 서버에서 SVG로 그립니다. 0시 위, 시계 방향. 바깥 고리 바탕(#F7F8FA) 위에 야간 음영 띠, 시간별 막대(이내 #86AEF4, 가장 많은 시간 #246BEB, 초과분 #EB003B를 안쪽부터), 6시간 눈금, 0·6·12·18시 라벨, 가운데 총 사건 수와 "기준 초과 N"을 둡니다. 막대마다 title로 값을 읽을 수 있고, 전체에 aria-label 요약이 붙습니다.

### AI Writing Surface
AI 요약문과 메시지 초안은 생성 중 "생각 중" 스피너와 점, 이어서 한 글자씩 써 내려가는 커서를 보여 줍니다. 이 반복 움직임은 생성 중 상태에만 존재합니다.

### 기록에 대해 묻기 (Ask)
리포트 AI 카드 아래에 둡니다. 존댓말 추천 질문 칩 5개(13px, 회색 테두리, hover 시 파랑 테두리)와 120자 입력, 보조 버튼(`btn--secondary`) "묻기"가 한 줄입니다. 주 버튼은 화면에 하나만 둡니다. 답은 회색 바탕(#F7F8FA 계열) 칸에 질문(14px 700)과 답(15px, 1.7, 최대 70ch)으로 쌓이고, 아래에 "AI 답변 · 저장되지 않음" 메타가 붙습니다. 생성 중에는 AI Writing Surface와 같은 "생각 중" 표시를 씁니다.

### 공유 링크 줄과 공유 화면
링크를 만들면 옅은 파랑 면(#ECF2FE, 테두리 #D3E1FB) 한 줄에 링크와 복사 버튼이 나타납니다. `/s/:token`의 공유 화면은 읽기 전용이며 다이얼, 사실 목록, 요약문, 소음원 막대 순서로 둡니다. 막대 아래에는 "진한 막대와 빨간 숫자는 기준 초과"라는 범례 문장과 기준값을 적습니다. 메모는 보여 주지 않고 만료일을 바닥글에 씁니다.

### 파일 분석 띠
감지 화면 오른쪽 칸 맨 위의 파일 카드입니다. 1초마다 한 칸씩 띠를 그립니다. 분류된 칸은 행정 파랑(#246BEB), 확실하지 않은 칸은 회색(#E3E7EC)입니다. 목록에는 시각, 그룹, YAMNet 라벨과 신뢰도만 쓰고 dB는 쓰지 않습니다. 파일 소리 크기는 마이크 보정과 무관하므로 숫자를 지어내지 않습니다.

### 화면 어둡게 (Night Cover)
감지 중 밤새 켜 둘 때 쓰는 전면 검정(#000) 덮개입니다. 시계는 64px 굵기 400의 #56627A로 눈부시지 않게 둡니다. dB와 사건 수 줄, 안내 문구는 #7C8AA3(약 6:1)로 읽히게 합니다. 화면을 누르거나 Esc를 누르면 닫힙니다. 움직임은 없습니다.

### 바닥 진동 줄
감지 카드의 게이지 아래, AI 상위 3개 위에 둡니다. 왼쪽 "바닥 진동" 라벨(아이콘 #0B50D0 계열), 오른쪽 상태 문구(12px 회색), 아래 6px 막대(#246BEB, 로그 눈금)입니다. 충격 진동인 1초에는 상태 문구가 "충격 진동 감지"(700, 짙은 파랑)로 바뀝니다. 진동은 초과가 아니므로 빨강을 쓰지 않습니다. 기록 상세 그래프에서는 진동이 잡힌 초를 옅은 파랑(#D3E1FB) 세로 띠와 아래 작은 눈금으로 표시하고, 목록에는 "진동 동반" 파랑 글자 태그를 붙입니다.

### 배려 알림 배너
소음을 내는 쪽 모드에서 감지 카드의 소음원 아래에 뜹니다. 종 아이콘, 제목(15px 700), 본문(14px, 소음원·dB·기준·행동 팁)입니다. 기준에 가까우면 옅은 파랑 면, 넘으면 옅은 빨강 면(#FDEEF1, 테두리 #FBD5DD)입니다. 8초 뒤 사라지고, 화면 어둡게 모드에서는 시계 아래 한 줄(#9AA9C2)로 보입니다. 움직임 효과는 없습니다.

### 감지 요약 시트
감지를 멈추면(10초 이상) 하단 시트가 열립니다. 감지 시간, 기록된 사건, 기준 초과, 가장 많은 소리, 가장 큰 소리를 `dl.kv` 행(왼쪽 회색 이름, 오른쪽 600 숫자, 점선 구분)으로 보여 줍니다. 버튼은 닫기, 기록 보기, 리포트 세 개입니다. 모달이 열리면 떠 있던 토스트를 먼저 치워 시트를 가리지 않게 합니다.

## Do's and Don'ts

### Do:
- **Do** 판정 옆에 근거(기준값 dB, 측정 방식, 주간·야간)를 함께 씁니다.
- **Do** 모든 측정 화면에 "공인 측정 아님" 고지를 한 줄로 둡니다.
- **Do** 데모 데이터가 섞인 화면·인쇄물·CSV에는 데모 표시를 남깁니다.
- **Do** 크기 변화는 transform(scaleX/scaleY)으로 움직이고, 지속 시간은 140~350ms, `cubic-bezier(0.23, 1, 0.32, 1)`을 씁니다.
- **Do** 야간 자동 설정에서는 토큰만 바꿔 어두운 화면을 만듭니다.

### Don't:
- **Don't** 같은 크기의 숫자 카드를 격자로 늘어놓지 않습니다. 정의 목록이나 다이얼을 씁니다.
- **Don't** 이모지나 특수문자를 아이콘으로 쓰지 않습니다. src/shared/icons.js에 선 아이콘을 추가합니다.
- **Don't** 제목 위에 작은 머리글(eyebrow)을 두지 않습니다.
- **Don't** 카드나 안내문에 두꺼운 색 왼쪽 테두리를 쓰지 않습니다.
- **Don't** 감지 중 상태를 무한 반복 애니메이션으로 표시하지 않습니다.
- **Don't** 비활성 상태를 opacity로 흐리게 만들지 않습니다. 대비를 지키는 회색 토큰을 씁니다.
- **Don't** "위층", "윗집" 같은 위치 단정 표현을 화면 문구에 쓰지 않습니다.
