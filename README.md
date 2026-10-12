# 이웃소리 — 층간소음 AI 기록·중재 서비스

> 시끄럽다는 말 대신, AI가 정리한 기록으로 이웃과 대화하세요.
> 2026 AI 라이프 솔루션 챌린지 출품작 (산업통상부 주최, KEIT 주관)

스마트폰 마이크 소리를 **폰 안에서** AI(YAMNet, TensorFlow.js)가 발걸음·가구·망치·반려동물·악기·말소리 7개 그룹으로 분류하고, 공동주택 층간소음 기준(주간 39dB·야간 34dB 등)과 비교해 기준 초과 사건만 기록합니다. 생성형 AI가 감정 없는 리포트 요약문과 이웃·관리사무소·이웃사이센터용 중재 메시지 초안을 작성합니다. **녹음은 저장하지 않습니다.**

## 실행

```bash
npm install
cp .env.example .env        # 필요 시 LLM_PROVIDER=anthropic, ANTHROPIC_API_KEY=실제 키 설정
npm run download-model      # (선택) YAMNet 모델을 로컬에 셀프 호스팅. 생략하면 TF Hub에서 로드
npm start                   # http://localhost:3000
```

- 키 형식이 잘못되면(예시 문구, 한글, 공백 등) 서버 시작 때 경고를 출력하고 규칙 기반 작성기로 실행합니다.
- 로그인 없이 바로 사용합니다. 브라우저가 만든 익명 UUID(쿠키 `nsid` / 헤더 `X-User-Id`)로 사용자를 구분합니다.
- 마이크 권한이 필요하므로 **HTTPS 또는 localhost**에서 열어야 합니다. 모바일 브라우저(Android Chrome, iOS Safari) 권장.
- 설정 화면의 **데모 데이터 불러오기**로 35일치 모의 사건 약 400건(최근 7일 약 130건)을 넣어 기록·리포트·중재 화면을 바로 볼 수 있습니다. (`npm run seed`로도 가능)

## 테스트

```bash
npm test
```

Jest로 모든 함수의 성공·실패 케이스를 검증합니다(모델, 서비스, DTO, 미들웨어, 컨트롤러/라우트, 브라우저 공용 라이브러리, 화면 렌더링). 기능을 추가·수정할 때마다 전체 테스트를 실행해 의존 코드에 미치는 영향을 확인합니다.

## 구조 (MVC)

```
src/
  app.js, server.js        Express 앱 팩토리 / 진입점
  config/                  환경 변수, 기본 기준표(JSON), YAMNet 클래스→그룹 매핑(JSON)
  models/                  JSON 파일 DB (JsonStore, BaseModel, events/reports/messages/settings/thresholds)
  services/                도메인 로직 (사건, 기준 판정, 집계, 리포트, 메시지, 단계 안내, 데모 데이터)
  services/llm/            LLM 호출 계층 (Anthropic / 규칙 기반 Template, 교체 가능), 프롬프트 빌더
  controllers/             요청 처리 (화살표 함수 + async try/catch), 페이지 컨트롤러(SSR)
  dtos/                    입력 검증 DTO
  routes/                  API 라우터 / 페이지 라우터
  middlewares/             익명 사용자 식별, 에러 핸들러, 요청 로그
  views/                   EJS 템플릿 (감지·기록·리포트·중재·설정, 인쇄용 리포트)
  shared/                  서버·브라우저 공용 (상수, 기준 판정 규칙, 데시벨, 소음원 매핑, 평활화, 사건 판정기, 바닥 진동, 배려 알림, 측정 결과 설명)
  public/                  CSS(KRDS 색상 체계), 화면별 JS, 클래스맵 CSV, (선택) 로컬 모델
db/                        JSON 데이터 파일 (thresholds.json은 법 개정 시 여기만 수정)
tests/                     Jest 테스트
```

## API

| 메서드 | 경로 | 역할 |
|---|---|---|
| POST | /api/events | 사건 저장 (배열) — 서버가 기준 비교 후 초과 여부 저장. 바닥 진동(`vibration_sec`·`vibration_peak_mg`·`vibration_series`)은 선택 |
| GET | /api/events?from=&to=&source= | 기간·소음원별 사건 조회 |
| GET | /api/events/recent | 최근 사건 3개 |
| PATCH | /api/events/:id | 사건 메모 수정 |
| DELETE | /api/events/:id | 사건 삭제 |
| GET | /api/reports/summary?days=7 | 집계 JSON (서버 계산) |
| POST | /api/reports/generate | 집계 + LLM 요약문 생성·저장 |
| POST | /api/reports/generate/stream | 위와 같음, 생성 과정을 SSE로 실시간 전송 |
| GET | /api/reports/latest?days=7 | 최근 리포트 |
| POST | /api/reports/ask/stream | 기록에 대해 묻기 (추천 질문 또는 자유 질문 120자, SSE, 답은 저장하지 않음) |
| POST, GET, DELETE | /api/shares, /api/shares/:id | 읽기 전용 공유 링크 만들기·목록·취소 (14일 후 만료, 메모 제외) |
| POST | /api/messages/generate | 수신자(이웃/관리사무소/이웃사이센터)·말투(부드럽게/기본/단호하게) 메시지 초안 |
| POST | /api/messages/generate/stream | 위와 같음, 생성 과정을 SSE로 실시간 전송 |
| GET | /api/messages/next-step | 다음 단계 안내 |
| GET, PUT | /api/settings | 야간 시간, 보정 오프셋, 민감도 |
| POST | /api/settings/calibrate | 마이크 보정 (조용한 방 측정값 → 오프셋) |
| GET | /api/events/export.csv | 사건 CSV 내보내기 |
| PATCH | /api/messages/:id/delivered | 메시지 전달 표시 |
| GET | /api/messages/history | 메시지 이력 |
| POST, GET, DELETE | /api/lab/runs, /api/lab/summary | 분류 정확도 측정 기록·요약·삭제 |
| DELETE | /api/data | 전체 기록 삭제 |
| POST | /api/data/demo | 데모 데이터 생성 |
| GET | /api/health | 상태 확인 |

### 스트리밍 이벤트 (SSE)

`attempt`(생성 시작, 화면은 "생각 중") → `delta`(글 조각) … → `done`(저장 결과).
안전 검사에 걸리면 `retry`(화면을 지우고 다시 작성), 끝까지 실패하면 `fallback`(규칙 기반 작성기로 전환), 오류는 `error`.

## 화면

감지 · 기록 · 리포트 · 중재 · 설정(하단 탭, 1024px 이상은 왼쪽 세로 메뉴) + 법·대응 안내(상단 버튼) + 메인 소개 화면(`/`, 예전 주소 `/welcome`은 `/`로 이동) + 분류 정확도 측정(`/lab`) + 인쇄용 리포트(`/report/print`) + 읽기 전용 공유 화면(`/s/:token`).

- 리포트의 대표 요소는 24시간 소음 다이얼(`src/shared/dial.js`)입니다. 직전 기간에 기록한 날이 절반 이상일 때만 증감을 비교합니다.
- 리포트에서 "기록에 대해 묻기"로 패턴·평일과 주말·밤·지난 기간 비교·소음원을 물으면 AI가 집계 숫자만으로 답합니다. 법적 판단이나 위치·의도 추측은 하지 않습니다.
- "링크로 공유"는 관리사무소·이웃사이센터에 보낼 읽기 전용 링크를 만듭니다. 14일 후 만료되고, 언제든 취소할 수 있으며, 메모는 빠집니다.
- 감지 화면에서 소리 파일(30MB 이하, 앞 60초)을 골라 마이크 없이 AI 분류를 체험할 수 있습니다. 파일은 기기 밖으로 나가지 않습니다.
- **바닥 진동 결합**: 폰을 바닥에 평평하게 두면 가속도 센서(DeviceMotion)로 바닥 진동을 1초 단위로 잽니다(`src/shared/vibration.js`). 소리 사건과 진동이 함께 잡히면 "진동 동반"으로 저장되고(`vibration_sec`, `vibration_peak_mg`, `vibration_series`), 기록 상세 그래프에 파란 띠로, 리포트·공유·인쇄·CSV에 건수로 나옵니다. 앱이 폰을 진동시키는 동안은 측정을 쉽니다. 진동은 소리를 보강하는 근거일 뿐 위치를 뜻하지 않습니다.
- **배려 알림 (소음을 내는 쪽)**: 감지 중 우리 집 소리가 지금 시간대 기준의 3dB 이내로 2초 이상 이어지거나 기준을 넘으면 화면 배너와 진동으로 바로 알립니다(`src/shared/care-alert.js`, 30초 쉬는 시간, 가까움→넘음은 즉시).
- 감지 중에는 화면 꺼짐을 막고(Wake Lock), "화면 어둡게"로 밤새 켜 둘 수 있습니다. 감지를 멈추면 이번 감지 요약이 뜹니다.
- 기록 화면에서 사건을 누르면 1초 단위 dB 그래프와 메모가 있는 상세 시트가 열리고, 히트맵 칸을 누르면 그 시간대만 걸러 봅니다. CSV로 내려받을 수 있습니다.
- 중재 화면에서 "전달했어요"를 체크하면 다음 단계 안내가 전달일 기준으로 바뀌고, 메시지 이력이 남습니다.
- 설정에서 사용 방식(소음을 듣는 쪽/내는 쪽), 화면 테마(야간 자동/밝게/어둡게), 글자 크기를 고릅니다. 2005년 6월 30일 이전 승인 단지는 직접충격 기준에 2dB를 더합니다.
- 데모 데이터는 화면·인쇄물·CSV 어디서든 "데모"로 표시됩니다.
- `/lab`에서 공개 음원을 틀고 10초씩 측정하면 소음원별 정확도와 오분류 표가 쌓입니다. 성과보고서 정확도 칸에 쓰는 실측치입니다.

디자인 기준은 `DESIGN.md`(토큰·규칙), 제품 사실은 `PRODUCT.md`에 있습니다.
법·대응 안내 내용은 `src/config/legal-guide.json`에 있고 모든 법령·처벌 항목에 출처 URL과 확인 기준일이 붙습니다.

## 설계 원칙

- **오디오는 폰 밖으로 나가지 않습니다.** 분류와 데시벨 계산은 브라우저에서 하고 서버는 시각·소음원·dB JSON만 받습니다.
- **기준값은 코드가 아니라 테이블**(`db/thresholds.json`)에 둡니다. 소음원 매핑도 JSON 설정(`src/config/source-mapping.json`)입니다.
- **숫자는 서버가 계산하고 LLM은 글만 씁니다.** 생성 후 금지 표현(위협·비난·감정·추측)과 입력에 없는 숫자를 검사해 걸리면 재생성하고, 끝까지 실패하면 규칙 기반 작성기로 대체합니다.
- 메시지는 앱이 보내지 않습니다. 사용자가 복사해 직접 전달합니다.
- 화면과 리포트에 "공인 측정이 아니며 대화를 위한 참고 기록"임을 항상 표시합니다.

## 라이선스·출처

- YAMNet (Google, AudioSet), TensorFlow.js — Apache License 2.0
- 기준: 국토교통부·기후에너지환경부 「공동주택 층간소음의 범위와 기준에 관한 규칙」 별표 (2023-01-02 시행). 최고소음도 1시간 3회 이상 규칙, 2005-06-30 이전 단지 2dB 가산 반영
- 색상: 정부 디지털 서비스 디자인 시스템(KRDS) 색상 체계 참고

## 배포 (Render 무료)

GitHub Pages 같은 정적 호스팅에는 올릴 수 없습니다(서버 렌더링·JSON 파일 저장·서버 쪽 AI 호출). Render 무료 Web Service에 올립니다. 설정은 `render.yaml`에 있습니다.

1. GitHub에 push → Render 대시보드에서 **New → Blueprint** → 이 저장소 선택. `render.yaml`대로 서비스가 만들어집니다.
2. 서비스의 **Environment**에 `ANTHROPIC_API_KEY`를 직접 넣습니다(저장소에 두지 않음). 비우면 규칙 기반 작성기로 동작합니다.
3. YAMNet 모델(`src/public/models/yamnet/`, 약 16MB)은 저장소에 포함되어 있어 그대로 셀프 호스팅됩니다. 옛 TF Hub 주소(tfhub.dev)는 2025년 이후 404라 `npm run download-model`과 브라우저 대체 경로는 더 이상 동작하지 않으므로, 모델 파일을 저장소에서 지우지 마세요.
4. 배포가 끝나면 `https://<서비스이름>.onrender.com` 이 HTTPS 주소입니다. 마이크·진동 센서는 HTTPS에서만 동작합니다.

무료 플랜의 한계와 대처:
- **15분 동안 접속이 없으면 잠듭니다.** 첫 접속이 30~50초 걸립니다. `.github/workflows/keep-alive.yml`이 GitHub Actions로 10분마다 `/api/health`를 호출해 깨어 있게 합니다. Render 주소가 `https://neighbor-sound.onrender.com`과 다르면 저장소 Settings → Secrets and variables → Actions → Variables에 `APP_URL`을 넣으세요. (GitHub는 60일 동안 커밋이 없는 저장소의 예약 작업을 멈추므로, 심사 기간에 가끔 커밋이 있으면 안전합니다.)
- **디스크가 임시입니다.** 재배포·재시작 때 `db/*.json` 기록이 초기화됩니다(기준표 `db/thresholds.json`은 저장소에 있어 유지). 심사위원은 메인의 "데모 기록으로 둘러보기"로 자기 기록을 바로 만들 수 있으므로 데모에는 지장이 없습니다. 실제 기록을 오래 보관하려면 유료 디스크나 외부 DB가 필요합니다.
