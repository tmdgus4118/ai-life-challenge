const request = require('supertest');
const { startApp, stopApp } = require('../http-helpers');
const { AppConfig } = require('../../src/config/env');
const { makeTempDbDir, removeDir, USER_A, sampleEventInput } = require('../helpers');

describe('SSR 화면', () => {
  let dir; let app;
  const as = () => ({ 'X-User-Id': USER_A });
  beforeAll(async () => {
    dir = makeTempDbDir();
    app = await startApp({ config: new AppConfig({ DB_DIR: dir, LLM_PROVIDER: 'template', NODE_ENV: 'test' }) });
    await request(app.server).post('/api/events').set(as()).send([sampleEventInput({ memo: '아이가 깨어남' })]);
  });
  afterAll(async () => { await stopApp(app); removeDir(dir); });

  test('/: 메인 페이지는 서비스 소개 (재방문도 같음), /welcome은 /로 영구 이동', async () => {
    const first = await request(app.server).get('/').set(as());
    expect(first.status).toBe(200);
    expect(first.text).toContain('기록으로 이웃과 대화하세요');
    const again = await request(app.server).get('/').set(as()).set('Cookie', 'ns_onboarded=1');
    expect(again.status).toBe(200);
    const old = await request(app.server).get('/welcome');
    expect(old.status).toBe(301);
    expect(old.headers.location).toBe('/');
  });

  test('메인 화면: 한 줄 소개, 예시 다이얼(예시 표기), 세 단계, 녹음 미저장, 데모 버튼, 모델 이름 미노출', async () => {
    const res = await request(app.server).get('/').set(as());
    ['기록으로 이웃과 대화하세요', 'class="dial"', '예시 기록', '듣기', '기록', '대화', '녹음은 저장하지 않습니다', 'id="demoStart"', '심사위원께', '/js/welcome.js', 'href="/"'].forEach((t) => expect(res.text).toContain(t));
    expect(res.text).not.toContain('YAMNet');
    expect(res.headers['set-cookie'] || []).not.toEqual(expect.arrayContaining([expect.stringContaining('ns_onboarded')]));
  });

  test('감지 화면: 녹음 버튼, 게이지, 우리 집 버튼, 최근 사건, 안내 모달', async () => {
    const res = await request(app.server).get('/detect').set(as());
    expect(res.text).toContain('id="levelWord"');
    ['id="fileInput"', '소리 파일로 AI 체험', '/js/file-analyze.js', 'id="nightCover"', 'id="dimBtn"', 'id="sessionModal"', '기기 밖으로 보내지 않고'].forEach((t) => expect(res.text).toContain(t));
    expect(res.text).toContain('id="topk"');
    expect(res.status).toBe(200);
    ['id="recordBtn"', 'id="gaugeSvg"', 'id="excludeBtn"', '누르면 제외 시작', '다시 누를 때까지의 소리만', '/shared/exclusion-toggle.js', '최근 사건 3개', '천장 없는 쪽 바닥', '공인 측정 아님', 'tf.min.js', '/js/detect.js'].forEach((s) => expect(res.text).toContain(s));
    expect(res.text).toContain('발걸음');
    expect(res.text).not.toContain('누르고 있는 동안');
  });

  test('기록 화면: 주 선택, 필터 칩 7개, 히트맵, 메모·삭제 모달', async () => {
    const res = await request(app.server).get('/records?week=2026-09-28').set(as());
    expect(res.status).toBe(200);
    ['2026.09.28', 'class="heatmap"', 'id="detailSheet"', 'id="detailSpark"', 'id="deleteModal"', 'export.csv', '망치·공사', '반려동물', '아이가 깨어남', 'level-4'].forEach((s) => expect(res.text).toContain(s));
    const filtered = await request(app.server).get('/records?week=2026-09-28&source=pet').set(as());
    expect(filtered.text).toContain('기록된 사건이 없습니다');
  });
  test('기록 화면 실패: 잘못된 소음원 400, 잘못된 주 400', async () => {
    expect((await request(app.server).get('/records?source=x').set(as())).status).toBe(400);
    expect((await request(app.server).get('/records?week=20260928').set(as())).status).toBe(400);
  });

  test('리포트 화면: 기간 탭, 요약 카드 4, 막대, 시간대, AI 요약, PDF 버튼, 참고 고지', async () => {
    const res = await request(app.server).get('/report?days=14').set(as());
    expect(res.status).toBe(200);
    ['최근 7일', '최근 14일', '최근 30일', '총 사건', '기준 초과', '주된 소음원', '가장 많은 시간대', 'id="aiText"', 'id="regenBtn"', '/js/ai-stream.js', 'id="pdfBtn"', '공인 측정이 아닙니다', 'class="dial"', 'class="dial__night"', 'class="headline"', '소음원별 사건 수', '사용자 메모', 'id="shareBtn"', '기록에게 묻기', 'data-key="weekday_weekend"', 'id="askInput"', 'id="linkBtn"'].forEach((s) => expect(res.text).toContain(s));
    expect(res.text).not.toContain('summary-grid');
    expect((await request(app.server).get('/report?days=9').set(as())).status).toBe(400);
  });

  test('인쇄용 리포트: 독립 레이아웃, 기준 출처, 모델 라이선스', async () => {
    const res = await request(app.server).get('/report/print?days=7').set(as());
    expect(res.status).toBe(200);
    ['생활소음 기록 리포트', '참고 고지', '공동주택 층간소음의 범위와 기준에 관한 규칙', 'Apache License 2.0', '1661-2642'].forEach((s) => expect(res.text).toContain(s));
    expect(res.text).not.toContain('class="tabbar"');
  });

  test('중재 화면: 수신자 탭 3, 말투 3, 복사 버튼, 다음 단계, 센터 번호', async () => {
    const res = await request(app.server).get('/mediate?recipient=management&tone=firm').set(as());
    expect(res.status).toBe(200);
    ['이웃', '관리사무소', '이웃사이센터', '부드럽게', '기본', '단호하게', 'id="copyBtn"', 'id="messageLive"', 'id="deliveredCheck"', '메시지 이력', '/js/ai-stream.js', '다음 단계 안내', 'tel:16612642', 'floor.noiseinfo.or.kr/floornoise', '기후에너지환경부', 'href="/guide"', '앱이 보내지 않습니다', '민원 형식'].forEach((s) => expect(res.text).toContain(s));
    expect((await request(app.server).get('/mediate?recipient=police').set(as())).status).toBe(400);
  });

  test('설정 화면: 야간 시간, 보정, 민감도, 삭제, 개인정보 안내, 기준표, 라이선스', async () => {
    const res = await request(app.server).get('/settings').set(as());
    expect(res.status).toBe(200);
    ['야간 시간', '마이크 보정', '민감도', '전체 기록 삭제', '개인정보 안내', '녹음을 저장하지 않습니다', '적용 기준표', 'YAMNet', 'Apache License 2.0', '데모 데이터 불러오기', 'name="classify_interval_sec"', 'name="legacy_building"', 'name="vibration_enabled"', 'name="care_alert"', '바닥 진동 함께 측정', '배려 알림', '1시간에 3회 이상', 'name="role"', 'value="maker"', 'name="theme"', '야간 자동', 'href="/lab"'].forEach((s) => expect(res.text).toContain(s));
  });

  test('법·대응 안내: 112 긴급, 안전 수칙, 6단계, 처벌 행동, 법령 표, 출처 링크, 상단 버튼 활성', async () => {
    const res = await request(app.server).get('/guide').set(as());
    expect(res.status).toBe(200);
    ['href="tel:112"', '꼭 지켜야 할 안전 수칙', '보복 소음을 내지 않습니다', '단계별 대응', '층간소음관리위원회 조정 신청', '공동주택관리 분쟁조정위원회', '환경분쟁조정피해구제위원회', '피해자도 처벌될 수 있는 행동', '2023도10313', '경범죄 처벌법', '관련 법령', 'law.go.kr', '확인 기준일 2026-10-02', '법률 자문이 아닙니다', 'class="app-header__guide is-active"'].forEach((t) => expect(res.text).toContain(t));
  });

  test('모든 화면 상단에 법·대응 안내 버튼이 있고 중복된 화면 이름 표시는 없다', async () => {
    for (const path of ['/detect', '/records', '/report', '/mediate', '/settings']) {
      const res = await request(app.server).get(path).set(as());
      expect(res.text).toContain('href="/guide"');
      expect(res.text).not.toContain('app-header__title');
    }
  });

  test('정확도 측정 화면: 정답 선택 6개, 측정 버튼, 요약, 엔진 스크립트', async () => {
    const res = await request(app.server).get('/lab').set(as());
    expect(res.status).toBe(200);
    ['name="expected"', 'value="footstep"', 'value="voice"', 'id="labStart"', '전체 정확도', '소음원별 정확도', '/js/audio-engine.js', '/js/lab.js', 'id="labFile"', '소리 파일로 측정'].forEach((t) => expect(res.text).toContain(t));
    expect(res.text).not.toContain('value="other"');
  });

  test('글자 크기 크게: html data-text="large", 설정 화면 선택지', async () => {
    await request(app.server).put('/api/settings').set(as()).send({ text_size: 'large' });
    const res = await request(app.server).get('/settings').set(as());
    expect(res.text).toContain('data-text="large"');
    expect(res.text).toContain('name="text_size"');
    await request(app.server).put('/api/settings').set(as()).send({ text_size: 'normal' });
    expect((await request(app.server).get('/detect').set(as())).text).toContain('data-text="normal"');
    expect((await request(app.server).put('/api/settings').set(as()).send({ text_size: 'huge' })).status).toBe(400);
  });

  test('/sw.js 서비스 워커, 인쇄용 리포트 다이얼', async () => {
    const sw = await request(app.server).get('/sw.js');
    expect(sw.status).toBe(200);
    expect(sw.text).toContain(`neighbor-sound-${app.locals.assetVersion}`);
    expect((await request(app.server).get('/detect').set(as())).text).toContain(`style.css?v=${app.locals.assetVersion}`);
    expect(sw.headers['content-type']).toContain('javascript');
    const print = await request(app.server).get('/report/print?days=7').set(as());
    expect(print.text).toContain('class="dial"');
    expect(print.text).toContain('24시간 소음 다이얼');
  });

  test('없는 페이지는 에러 화면 404', async () => {
    const res = await request(app.server).get('/nothing');
    expect(res.status).toBe(404);
    expect(res.text).toContain('문제가 발생했습니다');
  });

  test('정적 자원: 공용 라이브러리, 매핑 JSON, 클래스맵 CSV, 매니페스트', async () => {
    expect((await request(app.server).get('/shared/threshold-rules.js')).status).toBe(200);
    const map = await request(app.server).get('/config/source-mapping.json');
    expect(map.status).toBe(200);
    expect(map.body.groups.footstep).toContain('Walk, footsteps');
    expect((await request(app.server).get('/models/yamnet_class_map.csv')).status).toBe(200);
    expect((await request(app.server).get('/manifest.webmanifest')).status).toBe(200);
    expect((await request(app.server).get('/css/style.css')).status).toBe(200);
  });
});
