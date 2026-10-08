---
version: 1
slug: "src-views"
primary_target: "src/views"
related_targets: ["src/public/css/style.css"]
---

# Surface brief: 이웃소리 앱 전체 (감지·기록·리포트·중재·설정·안내·첫 방문)

Scope: 모바일 우선 웹앱 전체 화면. Visitor mode: Operate.
Audience/job: 심사위원이 데모 데이터로 30초 안에 서비스를 이해하고, 피해 가구가 밤에 기록·대화 준비를 끝낸다.
Constraints: KRDS 색상 고정, 의미색 빨강(초과)·파랑(정상), 차분·움직임 최소, 이모지 아이콘 금지, 오디오 미저장 문구 유지.
Unresolved: 실측 분류 정확도(측정 화면으로 수집), 실제 Claude 키 연동.

## Direction contract

THESIS: 이웃소리는 소음을 "하루의 시계" 위에 놓는다. 숫자 카드 네 장을 늘어놓는 대시보드 대신, 야간 구간이 칠해진 24시간 다이얼이 언제 무엇이 기준을 넘었는지를 한눈에 보여 준다.

OWN-WORLD: KRDS 파랑(#246BEB 계열)·빨강(#EB003B 계열)·청회색 중립. 밝은 화면은 연한 청회색 바탕에 흰 면, 야간은 남색 바탕(#0F1726 계열)에 같은 의미색. Pretendard GOV 한 가족, 숫자는 tabular. 측정값은 크게(단위 작게), 라벨은 작고 조용하게. 아이콘은 1.8px 선 SVG 한 세트. 면은 그림자 대신 미세한 경계와 한 단계 높이.

STORY: 처음 온 사람은 첫 방문 화면에서 감지·기록·대화 세 단계를 보고 "데모로 둘러보기"를 누른다. 리포트의 다이얼에서 평일 밤 22~23시가 빨갛게 몰린 것을 보고, AI가 그 패턴을 문장으로 쓰는 것을 지켜보고, 중재 화면에서 이웃에게 보낼 정중한 초안을 복사한다.

FIRST VIEWPORT: 리포트 첫 화면은 기간 선택 아래 폭 꽉 찬 24시간 다이얼(지름 약 300px, 모바일 기준)이 차지한다. 바깥 고리에 시간별 사건 막대(초과는 빨강), 22~06시 야간 호는 남색 음영, 가운데 총 사건 수와 초과 수. 다이얼 아래 한 줄 핵심 패턴 문장과 지난 기간 대비 증감. 감지 화면 첫 화면은 큰 dB 숫자와 상태 단어, 기준선이 있는 반원 게이지, AI가 듣고 있는 상위 3개 소리.

FORM: 사용자가 지정한 방향(정부 표준 색상 + Apple 건강·소음 앱 수준의 측정 화면, 차분·움직임 최소)을 따르는 canon 경로. 시드 추첨 없음(user-pinned). Signature move: 24시간 소음 다이얼.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
